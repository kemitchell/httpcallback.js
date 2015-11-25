module.exports = HTTPCallback

var EventEmitter = require('events').EventEmitter
var concat = require('concat-stream')
var http = require('http')
var https = require('https')
var inherits = require('util').inherits
var retry = require('retry')
var url = require('url')

function HTTPCallback(options) {
  options = ( options || {} )
  this.retryOptions =  ( 'retry' in options ? options.retry : { } )
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

prototype.send = function(dataCallback) {
  var self = this
  self._forEachListener(function(listener) {
    self._sendDataToListener(dataCallback, listener, function(error) {
      if (error) {
        self.emit('failure', error)
        self._deregister(listener.href) } }) }) }

prototype._sendDataToListener = function(dataCallback, listener, errback) {
  var self = this
  var protocol = ( listener.protocol === 'https:' ? https : http )
  var operation = retry.operation(self.retryOptions)
  operation.attempt(function(count) {
    self.emit('attempt', listener.href, count)
    var request = protocol.request(self._parsedURLToRequestOptions(listener))
      .once('response', function() {
        // TODO treat error responses as failures
        self.emit('success', listener.href)
        errback() })
      .once('error', function(error) {
        if (!operation.retry(error)) {
          errback(operation.mainError()) } })
    dataCallback(request) }) }

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

prototype.callbackListeners = function() {
  return Object.keys(this.listeners) }
