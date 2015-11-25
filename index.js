module.exports = HTTPCallback

var http = require('http')
var https = require('https')
var EventEmitter = require('events').EventEmitter
var concat = require('concat-stream')
var inherits = require('util').inherits
var url = require('url')

function HTTPCallback() {
  this.listeners = { }
  EventEmitter.call(this) }

inherits(HTTPCallback, EventEmitter)

var prototype = HTTPCallback.prototype

prototype.handler = function(request, response) {
  // TODO Check that the callback registration request comes from the same host as the hook target.
  var listeners = this.listeners
  var emit = this.emit.bind(this)
  request.pipe(concat(function(body) {
    var parsedURL = Object.freeze(url.parse(body.toString()))
    var href = parsedURL.href
    var providedMinimumURLComponents = (
      parsedURL.protocol &&
      ( parsedURL.protocol === 'https:' ||
        parsedURL.protocol === 'http:' ) &&
      parsedURL.hostname )
    if (providedMinimumURLComponents) {
      // Store the provided callback.
      listeners[href] = parsedURL
      // Respond 201
      response.statusCode = 201
      response.end()
      // Emit an event.
      emit('registration', parsedURL) }
    else {
      // Respond 400.
      response.statusCode = 400
      response.end('Invalid URL')
      // Emit an event.
      emit('badrequest', parsedURL) } })) }

prototype.send = function(callback) {
  var listeners = this.listeners
  Object.keys(listeners)
    .forEach(function(href) {
      var listener = listeners[href]
      var options = {
        auth: listener.auth,
        host: listener.hostname,
        query: listener.query,
        method: 'POST',
        port: ( listener.port || 80 ),
        path: ( listener.pathname || '/' ) }
      var protocol = ( listener.protocol === 'https:' ? https : http )
      var request = protocol.request(
        options,
        function() {
          // TODO retry
          // TODO check failure
          return null })
      callback(request) }) }
