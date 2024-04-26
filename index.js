'use strict'

require('dotenv').config()

const HyperExpress = require('hyper-express')
const webserver = new HyperExpress.Server()
const mqtt = require('mqtt')

const brokerUrl = process.env.BROKER_URL || 'test.mosquitto.org'
const brokerPort = process.env.BROKER_PORT || 1883
const topicBase = process.env.TOPIC_BASE || ''
const mqttClientId = process.env.MQTT_CLIENTID || 'http2mqtt'
const mqttQOS = process.env.MQTT_QOS || 0
const mqttUsername = process.env.MQTT_USERNAME
const mqttPassword = process.env.MQTT_PASSWORD
const httpPort = process.env.PORT || 3000

// capture all incoming HTTP traffic
webserver.all('*', controller)

// standup web server
webserver.listen(httpPort || 3000)
  .then((socket) => {
    console.log(`Hyper Express web server started on port ${httpPort}`)
  }).catch((error) => console.log('Failed to start Hyper Express web server', error))

// connect to MQTT broker
let mqttClient = mqtt.connect({
  username: mqttUsername,
  password: mqttPassword,
  clientId: `${mqttClientId}-${Date.now()}`,
  host: brokerUrl,
  port: brokerPort,
}).once('connect', () => {
  console.log(`MQTT client connected to ${brokerUrl}`)
}).once('close', () => {
  console.log('MQTT client disconnected')
}).on('reconnect', () => {
  console.log('MQTT client reconnected')
}).on('error', (error) => {
  console.log('MQTT client error', error)
}).on('message', (topic, payload) => {
  console.log('MQTT client message received', topic, payload.toString())
})

// handle incoming traffic
async function controller(request, response) {
  const headers = request.headers
  const topic = `${topicBase}${request.path}`
  const body = await request.json()

  // console.log('-'.repeat(20))

  // console.dir({
  //   headers,
  //   topic,
  //   body
  // })

  let message = body || null
  if (typeof message === 'object') {
    message = JSON.stringify(message)
  }

  mqttClient.publish(topic, message, { mqttQOS }, (error) => {
    if (error) console.log(error)
  })

  return response.status(200).send('OK')
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

function cleanup () {
  mqttClient.end()

  webserver.close( function () {
    console.log( "Closed out remaining connections.");
    // Close db connections, other chores, etc.
    process.exit()
  })

  setTimeout( function () {
   console.error("Could not close connections in time, forcing shut down")
   process.exit(1)
  }, 30*1000)

}

