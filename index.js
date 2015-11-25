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

// An HTTP request handler that registers HTTP callback endpoints. Suitable for
// use with the core Node.js HTTP module.
prototype.handler = function(request, response) {
  // TODO Check that the callback registration request comes from the same host as the hook target.
  var self = this
  request.pipe(concat(function(body) {
    var parsedURL = parseBody(body.toString())
    var href = parsedURL.href
    if (validBody(parsedURL)) {
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

// Helper function to parse HTTP request bodies sent to endpoints to register
// callback URLS.
function parseBody(string) {
  // Freeze the object, to prevent event listeners from mutating it.
  return Object.freeze(url.parse(string)) }

// Helper function to check whether an HTTP request body with a callback URL
// includes all the URL components needed to make callback HTTP requests.
function validBody(parsedURL) {
  var protocol = parsedURL.protocol
  return (
    ( protocol === 'https:' || protocol === 'http:' ) &&
    parsedURL.hostname ) }

// Send data to all registered HTTP callback endpoints, passing a function that
// will write data to the bodies of requests sent.
prototype.send = function(dataCallback) {
  var self = this
  self._forEachListener(function(listener) {
    self._sendDataToListener(dataCallback, listener, function(error) {
      if (error) {
        self.emit('failure', error)
        self._deregister(listener.href) } }) }) }

// Helper function to call back to a specific HTTP endpoint, retrying according
// to configuration and emitting events.
prototype._sendDataToListener = function(dataCallback, listener, errback) {
  var self = this
  var protocol = ( listener.protocol === 'https:' ? https : http )
  var operation = retry.operation(self.retryOptions)
  operation.attempt(function(count) {
    self.emit('attempt', listener.href, count)
    var request = protocol.request(parsedURLToRequestOptions(listener))
      .once('response', function() {
        // TODO treat error responses as failures
        self.emit('success', listener.href)
        errback() })
      .once('error', function(error) {
        if (!operation.retry(error)) {
          errback(operation.mainError()) } })
    dataCallback(request) }) }

// Helper functionto iterate registered HTTP callback endpoints.
prototype._forEachListener = function(callback) {
  var listeners = this.listeners
  Object.keys(listeners).forEach(function(href) {
    callback(listeners[href]) }) }

// Helper function to convert objects created with url.parse into options
// arguments for http.request when sending callback requests.
function parsedURLToRequestOptions(parsedURL) {
  return {
    auth: parsedURL.auth,
    host: parsedURL.hostname,
    method: 'POST',
    path: ( parsedURL.pathname || '/' ),
    port: ( parsedURL.port || 80 ),
    query: parsedURL.query } }

// Helper function to deregister an HTTP callback endpoint.
prototype._deregister = function(href) {
  delete this.listeners[href]
  this.emit('deregistration', href) }

// Returns an array of all HREFs of registered callback endpoints.
prototype.callbackListeners = function() {
  return Object.keys(this.listeners) }
