#include <WiFi.h>
#include <PubSubClient.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <time.h>
#include <secrets.h>
#include <CronAlarms.h>

void setup(){
    Serial.begin(9600);
    Serial.println("Hello World!");
}

void loop() {}