#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <time.h>
#include <CronAlarms.h>

const int relayPin = 2;
const long utcOffsetInSeconds = 25200;
bool relayState = true;

// wifi configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT configuration

const char* mqtt_server = "YOUR_BROKER_ADDRESS";
const int mqtt_port = 1883;
String deviceIdString = String(ESP.getChipId(), HEX);
const char* deviceId = deviceIdString.c_str();

// timing constants
const unsigned long MQTT_RECONNECT_DELAY = 5000;  // 5 seconds
const unsigned long HEARTBEAT_INTERVAL = 1000;    // 1 seconds
const unsigned long WIFI_TIMEOUT = 10000;         // 10 seconds
const int MQTT_BUFFER_SIZE = 512;

// Global state structure
struct ConnectionState {
    unsigned long lastHeartbeatMillis = 0;
    unsigned long lastReconnectAttempt = 0;
    bool needsWifiReconnect = false;
    bool needsMqttReconnect = false;
    bool isReconnecting = false;
    int wateringDurationInMs = 5000;
    String cronExpression = "0 * * * * *";
    unsigned long wateringStartedMillis = 0;
};

// Global variables
ConnectionState state;
WiFiUDP ntpUDP;
WiFiClient wifiClient;
PubSubClient client(wifiClient);
NTPClient timeClient(ntpUDP, "id.pool.ntp.org", utcOffsetInSeconds);
CronId wateringCronId;

// Function declarations
bool isWifiConnected();
bool isMqttConnected();
bool isWatering();
void handleWifiConnection();
void handleMqttConnection(unsigned long currentMillis);
void handleHeartbeat(unsigned long currentMillis);
void mqttCallback(char* topic, byte* payload, unsigned int length);

// WiFi initialization
void initWifi() {
    if (WiFi.status() == WL_CONNECTED) return;
    
    Serial.print("Connecting To Wifi With SSID -> ");
    Serial.println(ssid);
    
    WiFi.mode(WIFI_STA);
    WiFi.disconnect();
    Cron.delay(100);
    
    WiFi.begin(ssid, password);
    
    unsigned long startAttemptTime = millis();
    
    while (WiFi.status() != WL_CONNECTED && 
           millis() - startAttemptTime < WIFI_TIMEOUT) {
        Cron.delay(500);
        Serial.print(".");
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nConnected to WiFi");
        Serial.print("IP address: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\nFailed to connect to WiFi. Will retry later.");
    }
}

// MQTT initialization
bool reconnectMqtt() {
    if (client.connected() || state.isReconnecting) return true;
    
    Serial.println("Attempting MQTT Connection...");
    state.isReconnecting = true;
    
    // Create unique client ID

    if (client.connect(deviceId)) {
        Serial.println("Connected to MQTT Broker");
        String setDurationTopic = String("esp/") + String(deviceId) + String("/watering/setDurationInMs");
        String setCronTopic = String("esp/") + String(deviceId) + String("/watering/setCron");
        String triggerTopic = String("esp/") + String(deviceId) + String("/watering/trigger");
        client.subscribe(setDurationTopic.c_str());
        client.subscribe(setCronTopic.c_str());
        client.subscribe(triggerTopic.c_str());
        // Send initial message
      
        client.publish("esp/init", deviceId, true);
        
        state.isReconnecting = false;
        return true;
    } else {
        Serial.print("Failed to connect to MQTT Broker. RC=");
        Serial.println(client.state());
        state.isReconnecting = false;
        return false;
    }
}

void setupNTP() {
  timeClient.begin();
  timeClient.setTimeOffset(utcOffsetInSeconds);
  
  // First time sync
  while (!timeClient.update()) {
    timeClient.forceUpdate();
    Cron.delay(500);
  }
  
  // Set system time from NTP
  time_t epochTime = timeClient.getEpochTime();
  struct timeval tv = { epochTime, 0 };
  settimeofday(&tv, nullptr);
  
  Serial.println("Time synchronized with NTP server");
}

void syncTime(){
  time_t epochTime = timeClient.getEpochTime();
  struct timeval tv = { epochTime, 0 };
  settimeofday(&tv, nullptr);
  
  // Serial.println("System Time synchronized");
}

// Connection checks
bool isWifiConnected() {
    bool connected = (WiFi.status() == WL_CONNECTED);
    state.needsWifiReconnect = !connected;
    return connected;
}

bool isMqttConnected() {
    bool connected = client.connected();
    state.needsMqttReconnect = !connected;
    return connected;
}

// Connection handlers
void handleWifiConnection() {
    if (!state.needsWifiReconnect) return;
    
    Serial.println("WiFi disconnected! Attempting reconnection...");
    initWifi();
    Cron.delay(500);  // Allow connection to stabilize
}

void handleMqttConnection(unsigned long currentMillis) {
    if (!state.needsMqttReconnect) return;
    
    if (currentMillis - state.lastReconnectAttempt > MQTT_RECONNECT_DELAY) {
        state.lastReconnectAttempt = currentMillis;
        
        if (reconnectMqtt()) {
            state.lastReconnectAttempt = 0;
            state.needsMqttReconnect = false;
        }
    }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
    String message = "";
    for (unsigned int i = 0; i < length; i++) {
        message += (char)payload[i];
    }

    Serial.print("Message arrived [");
    Serial.print(topic);
    Serial.print("] ");
    Serial.println(message);

    if (strcmp(topic, (String("esp/") + String(deviceId) + String("/watering/setCron")).c_str()) == 0) {
        state.cronExpression = message;
        Serial.println("got setCron message changing cron");
        changeCronJob();
    } else if (strcmp(topic, (String("esp/") + String(deviceId) + String("/watering/setDurationInMs")).c_str()) == 0) {
        state.wateringDurationInMs = message.toInt();
        Serial.println("got setDurationInMs changing duration");
        changeCronJob();
    } else if (strcmp(topic, (String("esp/") + String(deviceId) + String("/watering/trigger")).c_str()) == 0) {
        if (message == "on") {
            Serial.println("Stopping Watering..");
            digitalWrite(relayPin, HIGH);
            state.wateringStartedMillis = 0;
            relayState = true;
        } else {
            Serial.println("Starting watering...");
            digitalWrite(relayPin, LOW);
            state.wateringStartedMillis = millis();
            relayState = false;
        }
    }
}

void sendHeartbeat() {
    if (!client.connected()) return;
    timeClient.update();  // Get the current time from your time client

    // Get the current epoch time (Unix timestamp)
    unsigned long epochTime = timeClient.getEpochTime();

    // Convert epoch time to a tm struct (local time)
    time_t rawTime = epochTime;
    struct tm *timeInfo = localtime(&rawTime); 

    // Get milliseconds (since the current code only gives second precision)
    unsigned long milliseconds = millis() % 1000;  // Get the last 3 digits of milliseconds

    // Format the date in ISO 8601 format: yyyy-mm-ddTHH:MM:SS.mmmZ
    char dateStr[30];
    snprintf(dateStr, sizeof(dateStr), "%04d-%02d-%02dT%02d:%02d:%02d.%03lu", 
             timeInfo->tm_year + 1900,  // tm_year is years since 1900
             timeInfo->tm_mon + 1,      // tm_mon is months since January (0-11)
             timeInfo->tm_mday,         // Day of the month
             timeInfo->tm_hour,         // Hour (0-23)
             timeInfo->tm_min,          // Minute (0-59)
             timeInfo->tm_sec,          // Second (0-59)
             milliseconds);             // Milliseconds

    // Output the ISO 8601 formatted date

    // Create the heartbeat message
    char heartbeatMsg[128];
    if (isWatering()) {
        sprintf(heartbeatMsg, "{\"date\":\"%s\",\"wateringDurationInMs\":%d,\"cronExp\":\"%s\",\"isWatering\":true}", 
                dateStr, state.wateringDurationInMs, state.cronExpression.c_str());
    } else {
        sprintf(heartbeatMsg, "{\"date\":\"%s\",\"wateringDurationInMs\":%d,\"cronExp\":\"%s\",\"isWatering\":false}", 
                dateStr, state.wateringDurationInMs, state.cronExpression.c_str());
    }

    // publish the heartbeat message
    const String heartbeatTopic = String("esp/") + String(deviceId) + String("/heartbeat");
    if (client.publish(heartbeatTopic.c_str(), heartbeatMsg)) {
        // Serial.println("Heartbeat sent");
    } else {
        Serial.println("Failed to send heartbeat");
    }
}


void handleHeartbeat(unsigned long currentMillis) {
    if (currentMillis - state.lastHeartbeatMillis > HEARTBEAT_INTERVAL) {
        state.lastHeartbeatMillis = currentMillis;
        sendHeartbeat();
    }
}

bool isWatering() {
    return !relayState;
}

void startWatering() {
    client.publish((String("esp/") + String(deviceId) + String("/watering/trigger")).c_str(), "off");
}

void stopWatering() {
    client.publish((String("esp/") + String(deviceId) + String("/watering/trigger")).c_str(), "on");
}

void changeCronJob() {
    if (wateringCronId) {
        Cron.free(wateringCronId);
    }
    char cronExp[state.cronExpression.length()+1];
    strcpy(cronExp, state.cronExpression.c_str());
    // state.cronExpression.toCharArray(cronExp, state.cronExpression.length() + 1);
    wateringCronId = Cron.create(cronExp, startWatering, false);
}

// setup function
void setup() {
    Serial.begin(115200);
    pinMode(relayPin, OUTPUT);
    
    // configure WiFi
    WiFi.mode(WIFI_STA);
    
    // configure MQTT client
    client.setServer(mqtt_server, mqtt_port);
    client.setCallback(mqttCallback);
    client.setBufferSize(MQTT_BUFFER_SIZE);
    
    // initial connections
    initWifi();
    setupNTP();
}

// Main loop
void loop() {

    unsigned long currentMillis = millis();
    
    // check and handle WiFi connection
    if (!isWifiConnected()) {
        handleWifiConnection();
        return;  // wait for WiFi before proceeding
    }
    
    // check and handle MQTT connection
    if (!isMqttConnected()) {
        handleMqttConnection(currentMillis);
        return;
    }
    // handle MQTT operations
    client.loop();
    handleHeartbeat(currentMillis);
    timeClient.update();
    syncTime();
    time_t tnow = time(nullptr);
    // Serial.println(asctime(gmtime(&tnow)));
    if (isWatering() && (millis() - state.wateringStartedMillis >= state.wateringDurationInMs)) {
        stopWatering();
    }
    Cron.delay(500);
}