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
  var self = this
  request.pipe(concat(function(body) {
    var parsedURL = self.parseBody(body.toString())
    var href = parsedURL.href
    if (self.validBody(parsedURL)) {
      // Store the provided callback.
      self.listeners[href] = parsedURL
      // Respond 201
      response.statusCode = 201
      response.end()
      // Emit an event.
      self.emit('registration', parsedURL) }
    else {
      // Respond 400.
      response.statusCode = 400
      response.end('Invalid URL')
      // Emit an event.
      self.emit('badrequest', parsedURL) } })) }

prototype.parseBody = function(string) {
  return Object.freeze(url.parse(string)) }

prototype.validBody = function(parsedURL) {
  var protocol = parsedURL.protocol
  return (
    protocol &&
    ( protocol === 'https:' || protocol === 'http:' ) &&
    parsedURL.hostname ) }

prototype.send = function(callback) {
  var self = this
  self._forEachListener(function(listener) {
    var protocol = ( listener.protocol === 'https:' ? https : http )
    var request = protocol.request(
      self._parsedURLToRequestOptions(listener),
      function() {
        // TODO retry
        // TODO treat error responses as failures
        return null })
    request.on('error', function(error) {
      self.emit('failure', error)
      self._deregister(listener.href) })
    callback(request) }) }

prototype._forEachListener = function(callback) {
  var listeners = this.listeners
  Object.keys(listeners).forEach(function(href) {
    callback(listeners[href]) }) }

prototype._parsedURLToRequestOptions = function(parsedURL) {
  return {
    auth: parsedURL.auth,
    host: parsedURL.hostname,
    method: 'POST',
    path: ( parsedURL.pathname || '/' ),
    port: ( parsedURL.port || 80 ),
    query: parsedURL.query } }

prototype._deregister = function(href) {
  delete this.listeners[href]
  this.emit('deregistration', href) }
