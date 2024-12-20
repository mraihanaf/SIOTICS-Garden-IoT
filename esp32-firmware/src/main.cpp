#include <WiFi.h>
#include <PubSubClient.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <secrets.h>
#include <CronAlarms.h>
#include <DHTesp.h>
#include <Preferences.h>
#include <HTTPUpdate.h>

#define relayPin 14
#define dhtPin 25
#define updateLedPin 33

const long utcOffsetInSeconds = 25200;

WiFiUDP ntpUDP;
WiFiClient wifiClient;
PubSubClient client(wifiClient);
NTPClient timeClient(ntpUDP, SERVER_ADDRESS, utcOffsetInSeconds);
DHTesp dhtSensor;

bool isMqttConnected();
bool isWifiConnected();
void mqttCallback(char* topic, byte* payload, unsigned int length);
bool reconnectMqtt();
bool connectToWifi();
void startAutoWatering();
void stopAutoWatering();
void updateNTP();

void update_started() {
  Serial.println("CALLBACK:  HTTP update process started");
  digitalWrite(updateLedPin, HIGH);
}

void update_finished() {
  Serial.println("CALLBACK:  HTTP update process finished");
  digitalWrite(updateLedPin, LOW);
}

void update_progress(int cur, int total) {
  Serial.printf("CALLBACK:  HTTP update process at %d of %d bytes...\n", cur, total);
}

void update_error(int err) {
  Serial.printf("CALLBACK:  HTTP update fatal error code %d\n", err);
}
struct ConnectionState {
    bool isMqttReconnecting = false;
};

const String NOT_A_STRING = "";
struct SprinklerConfig {
    String cronExpression = NOT_A_STRING;
    unsigned int wateringDurationInMs = 0;
};

struct SprinklerState {
    bool manualState = false;
    bool autoState = false;
    unsigned long wateringStartedMillis;
};

class Sprinkler {
public:
    String deviceIdString;
    const char* deviceId;
    CronId sprinklerCronId;
    ConnectionState connectionState;
    SprinklerConfig config;
    SprinklerState state;

    Sprinkler() {
        this->sprinklerCronId = dtINVALID_ALARM_ID;
        this->deviceIdString = String(ESP.getEfuseMac(), HEX);
        this->deviceId = this->deviceIdString.c_str();
    }

    void configure() {
        if((this->config.wateringDurationInMs == 0) || this->config.cronExpression == NOT_A_STRING){
            Serial.println("NOT_CONFIGURED_YET");
            return;
        };
        if(this->sprinklerCronId != dtINVALID_ALARM_ID){
            Serial.println("Cron disabled");
            Cron.free(this->sprinklerCronId);
            this->sprinklerCronId = dtINVALID_ALARM_ID;
        }
        client.publish((String("sprinkler/"+this->deviceIdString+"/status")).c_str(), "ALIVE",true);
        char cronExp[this->config.cronExpression.length() + 1];
        strcpy(cronExp, this->config.cronExpression.c_str());

        this->sprinklerCronId = Cron.create(cronExp, startAutoWatering, false);
        Cron.enable(this->sprinklerCronId);
    }

    void loop() {
        if(this->state.autoState && (millis() - this->state.wateringStartedMillis >= this->config.wateringDurationInMs)){
            stopAutoWatering();
        }
    }
};

Sprinkler sprinkler;

void startAutoWatering() {
    if(sprinkler.state.manualState == true){
        Serial.println("Auto watering cancelled because sprinkler already active");
        return;
    }
    Serial.println("Starting auto watering...");
    sprinkler.state.wateringStartedMillis = millis();
    sprinkler.state.autoState = true;
    client.publish((String("sprinkler/") + sprinkler.deviceIdString + String("/trigger")).c_str(), "AUTO.ON");
    client.publish((String("sprinkler/"+sprinkler.deviceIdString+"/status")).c_str(), "WATERING.AUTO", true);
    digitalWrite(relayPin, HIGH);
}

void stopAutoWatering() {
    Serial.println("Auto watering done.");
    sprinkler.state.autoState = false;
    sprinkler.state.wateringStartedMillis = 0;
    digitalWrite(relayPin, LOW);
    client.publish((String("sprinkler/"+sprinkler.deviceIdString+"/status")).c_str(), "ALIVE", true);
    client.publish((String("sprinkler/") + sprinkler.deviceIdString + String("/trigger")).c_str(), "AUTO.OFF");
}

bool isMqttConnected() {
    return client.connected();
}

bool isWifiConnected() {
    return wifiClient.connected();
}

bool reconnectMqtt() {
    if (!client.connected() && !sprinkler.connectionState.isMqttReconnecting) {
        sprinkler.connectionState.isMqttReconnecting = true;
        Serial.println("Attempting MQTT Connection...");

        String willTopicString = String(String("sprinkler/") + sprinkler.deviceIdString + "/status");
        const char* willTopic = willTopicString.c_str();
        const char* willMessage = "DEAD";
        Serial.println(willTopic);

        bool connected = client.connect(
            sprinkler.deviceId,
            MQTT_USERNAME,
            MQTT_PASSWORD,
            willTopic,
            1,
            true,
            willMessage
        );

        if (connected) {
            timeClient.forceUpdate();
            updateNTP();
            Serial.println("NTP Updated.");
            // setup mqtt client here
            const String subTopicString = String("sprinkler/") + sprinkler.deviceIdString + String("/+");
            const char* subTopic = subTopicString.c_str();
            Serial.println(subTopic);
            client.subscribe(subTopic);
            client.subscribe((String("sprinkler/") + sprinkler.deviceIdString + String("/config/+")).c_str());
            client.subscribe("firmware-update");
            Serial.println("MQTT Connected.");
            sprinkler.connectionState.isMqttReconnecting = false;
        } else {
            sprinkler.connectionState.isMqttReconnecting = false;
            Serial.println("Failed to connect.");
            Cron.delay(5000);
        }
    }
    return client.connected();
}

bool connectToWifi() {
    Cron.delay(50);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.print("Connecting to the Wifi");

    while (WiFi.status() != WL_CONNECTED) {
        Serial.print('.');
        delay(1000);
    }

    Serial.println("Connected.");
    Serial.println(WiFi.localIP());
     Serial.println(WiFi.dnsIP());
  // WiFi.config(WiFi.localIP(), WiFi.gatewayIP(), WiFi.subnetMask(), IPAddress(8,8,8,8)); 
  delay(10);
  Serial.println(WiFi.dnsIP());
    return true;
}

void updateNTP() {
    timeClient.update();
    time_t epochTime = timeClient.getEpochTime();
    struct timeval tv = { epochTime, 0 };
    settimeofday(&tv, nullptr);
}

void publishSensor() {
    Serial.println("Mengirim data sensor");
    TempAndHumidity data = dhtSensor.getTempAndHumidity();
    client.publish((String("sprinkler/"+sprinkler.deviceIdString+"/sensors/temperature")).c_str(), (String(data.temperature).c_str()) );
    client.publish((String("sprinkler/"+sprinkler.deviceIdString+"/sensors/humidity")).c_str(), (String(data.humidity).c_str()) );
    Serial.println(timeClient.getFormattedTime());
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

    if(strcmp(topic, (String("sprinkler/") + sprinkler.deviceIdString + "/config/cron").c_str() ) == 0){
        sprinkler.config.cronExpression = message;
        Serial.print("cron config set to ");
        Serial.println(message);
        sprinkler.configure();
    } else if(strcmp(topic, (String("sprinkler/") + sprinkler.deviceIdString + "/config/duration").c_str() ) == 0){
        sprinkler.config.wateringDurationInMs = message.toInt();
        Serial.print("durationInMs config set to ");
        Serial.println(message);
        sprinkler.configure();
    } else if(strcmp(topic, (String("sprinkler/") + sprinkler.deviceIdString + "/trigger").c_str() ) == 0) {
        if(message == "MAN.ON") {
            Serial.println("Starting manual watering...");
            sprinkler.state.manualState = true;
            client.publish((String("sprinkler/"+sprinkler.deviceIdString+"/status")).c_str(), "WATERING.MAN", true);
            digitalWrite(relayPin, HIGH);
        } else if(message == "MAN.OFF") {
            Serial.println("Stopping manual watering...");
            sprinkler.state.manualState = false;
            client.publish((String("sprinkler/"+sprinkler.deviceIdString+"/status")).c_str(), "ALIVE", true);
            digitalWrite(relayPin, LOW);
        }
    } else if(strcmp(topic, "firmware-update") == 0){
        Serial.println("Firmware update requested, updating firmware..");
        const char* update_url = (String( String("http://") + String(SERVER_ADDRESS) + String(":") + String(HTTP_PORT) + String("/api/v1/firmware")).c_str());
        Serial.println(update_url);
        t_httpUpdate_return ret = httpUpdate.update(wifiClient, update_url);
        switch (ret) {
            case HTTP_UPDATE_FAILED: Serial.printf("HTTP_UPDATE_FAILED Error (%d): %s\n", httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str()); break;

            case HTTP_UPDATE_NO_UPDATES: Serial.println("HTTP_UPDATE_NO_UPDATES"); break;

            case HTTP_UPDATE_OK: Serial.println("HTTP_UPDATE_OK"); break;
        }
    }
}

void setup() {
    httpUpdate.onStart(update_started);
    httpUpdate.onEnd(update_finished);
    httpUpdate.onProgress(update_progress);
    httpUpdate.onError(update_error);
    client.setServer(SERVER_ADDRESS, MQTT_PORT);
    client.setKeepAlive(15);
    client.setCallback(mqttCallback);
    Serial.begin(9600);
    Serial.println(SERVER_ADDRESS);
    Serial.println(MQTT_PORT);
    pinMode(relayPin, OUTPUT);
    pinMode(updateLedPin, OUTPUT);
    dhtSensor.setup(dhtPin, DHTesp::DHT11);
    digitalWrite(relayPin, LOW);
    Serial.println("Hello World!");
    Serial.println(sprinkler.deviceId);
    connectToWifi();
    timeClient.forceUpdate();
    updateNTP();
    Serial.println("NTP Updated.");
    char everySeconds[] = "* * * * * *";
    CronId sensorPub = Cron.create(everySeconds, publishSensor, false);
    Cron.enable(sensorPub);
}

void loop() {
     client.loop();
    // Serial.print("Wifi ");
    // Serial.print(isWifiConnected());
    // Serial.print(" MQTT ");
    // Serial.println(isMqttConnected());
    if (!isMqttConnected()) {
        reconnectMqtt();
        const char* willTopic = String(String("sprinkler/") + sprinkler.deviceIdString + "/status").c_str();
        client.publish(willTopic, "INIT", true);
    }

    updateNTP();
    // Serial.println(timeClient.getFormattedTime());
    Cron.delay(1);
    sprinkler.loop();
    
}
