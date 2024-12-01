    #include <WiFi.h>
    #include <PubSubClient.h>
    #include <NTPClient.h>
    #include <WiFiUdp.h>
    #include <secrets.h>
    #include <CronAlarms.h>
    #include <Preferences.h>

    struct ConnectionState {
        bool isMqttReconnecting = false;
    };

    class Sprinkler {
        public:
            String deviceIdString;
            const char* deviceId;
            CronId sprinklerCronId;
            ConnectionState connectionState;
            Sprinkler() {
                this->deviceIdString = String(ESP.getEfuseMac(), HEX);
                this->deviceId = this->deviceIdString.c_str();
            }
    };

    const long utcOffsetInSeconds = 25200;

    Sprinkler sprinkler;
    WiFiUDP ntpUDP;
    WiFiClient wifiClient;
    PubSubClient client(wifiClient);
    NTPClient timeClient(ntpUDP, SERVER_ADDRESS, utcOffsetInSeconds);

    bool isMqttConnected();
    bool isWifiConnected();
    void mqttCallback(char* topic, byte* payload, unsigned int length);
    bool reconnectMqtt();
    bool connectToWifi();


    bool isMqttConnected() {
        return client.connected();
    }

    bool isWifiConnected() {
        return wifiClient.connected();
    }

    bool reconnectMqtt() {
        if(!client.connected() && !sprinkler.connectionState.isMqttReconnecting){
            sprinkler.connectionState.isMqttReconnecting = true;
            Serial.println("Attemping MQTT Connection...");
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
            if(connected){
                // setup mqtt client here
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
        delay(50);
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
        Serial.print("Connecting to the Wifi");
        while (WiFi.status() != WL_CONNECTED) {
            Serial.print('.');
            delay(1000);
        }
        Serial.println("Connected.");
        Serial.println(WiFi.localIP());
        return true;
    }  

    void updateNTP() {
        timeClient.update();
        time_t epochTime = timeClient.getEpochTime();
        struct timeval tv = { epochTime, 0 };
        settimeofday(&tv, nullptr);
        
    }

    void someFunc(){
        Serial.println("yeehaa");
    }

    void setup(){
        client.setServer(SERVER_ADDRESS, MQTT_PORT);
        Serial.begin(9600);
        Serial.println("Hello World!");
        Serial.println(sprinkler.deviceId);
        connectToWifi();
        updateNTP();
        Serial.println("NTP Updated.");
        Cron.create("*/2 * * * * *", someFunc, false);
    }

    
    void loop() {
        if(!isMqttConnected()){
            reconnectMqtt();
            const char* willTopic = String(String("sprinkler/") + sprinkler.deviceIdString + "/status").c_str();
            client.publish(willTopic, "INIT", true);
        }
        client.loop();
        updateNTP();
        Serial.println(timeClient.getFormattedTime());
        Cron.delay(1000);
} 