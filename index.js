module.exports = HTTPCallback

var EventEmitter = require('events').EventEmitter
var concat = require('concat-stream')
var http = require('http')
var https = require('https')
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
    var protocol = parsedURL.protocol
    var providedMinimumURLComponents = (
      protocol &&
      ( protocol === 'https:' || protocol === 'http:' ) &&
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
  var self = this
  Object.keys(listeners)
    .forEach(function(href) {
      var listener = listeners[href]
      var options = {
        auth: listener.auth,
        host: listener.hostname,
        method: 'POST',
        path: ( listener.pathname || '/' ),
        port: ( listener.port || 80 ),
        query: listener.query }
      var protocol = ( listener.protocol === 'https:' ? https : http )
      var request = protocol.request(
        options,
        function() {
          // TODO retry
          return null })
      request
        .on('error', function(error) {
          self.emit('failure', error)
          self._deregister(href) })
      callback(request) }) }

prototype._deregister = function(href) {
  delete this.listeners[href]
  this.emit('deregistration', href) }
