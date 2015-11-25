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

// TODO emit events

prototype.handler = function(request, response) {
    // TODO Check that the callback registration request comes from the same host as the hook target.
    var listeners = this.listeners
    request.pipe(concat(function(body) {
      var parsed = url.parse(body.toString())
      var href = parsed.href
      var hasAllProperties = (
        parsed.protocol &&
        ( parsed.protocol === 'https:' || parsed.protocol === 'http:' ) &&
        parsed.hostname )
      if (hasAllProperties) {
        // TODO log
        listeners[href] = parsed
        response.statusCode = 201
        response.end() }
      else {
        response.statusCode = 400
        response.end('Invalid URL') } })) }


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
