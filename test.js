var concat = require('concat-stream')
var http = require('http')
var HTTPCallback = require('./')
var tape = require('tape')
var url = require('url')

tape(function(test) {
  test.plan(3)
  // The data to send from an event source server to an event listener server.
  var CALLBACK_DATA = 'callback body'
  // Create an event source server with an example HTTPCallback.
  var example = new HTTPCallback()
  example
    .on('registration', function(parsedURL) {
      test.equal(
        parsedURL.pathname, '/receive',
        'callback emits registration event') })
  var source = http.createServer(
    function(request, response) {
      // The event source server proxies POST /register to the
      // HTTPCallback request handler.
      var callbackRequest = (
        request.method === 'POST' &&
        url.parse(request.url).pathname === '/register' )
      if (callbackRequest) {
        example.handler(request, response) }
      // Otherwise it fails with an error.
      else {
         throw new Error() } })
    // Start the event source server on a random high port.
    .listen(0, function() {
      // Record the random port for future reference.
      var sourcePort = this.address().port
      // Create an event listener server.
      var listener = http.createServer(
        // The event listener server responds to POST /receive.
        function(request, response) {
          var callbackRequest = (
            request.method === 'POST' &&
            url.parse(request.url).pathname === '/receive' )
          if (callbackRequest) {
            // Read the the body of the POST request.
            request.pipe(concat(function(buffer) {
              var asString = buffer.toString()
              // Should equal the value sent by the even source server.
              test.equal(
                asString, CALLBACK_DATA,
                'listener receives data via POST /receive')
              response.end()
              // Close our test servers.
              source.close()
              listener.close() })) }
          // Otherwise it fails with an error.
          else {
             throw new Error() } })
        // Also start the event listener server on a random high port.
        .listen(0, function() {
          // Record that random port, so we can tell the event source server
          // what port to call back on.
          var listenerPort = this.address().port
          var post = {
            port: sourcePort,
            path: '/register',
            method: 'POST' }
          // The body of the callback registration request to the event source
          // server is just the plain-text URL of the source listener server
          // where the event source server should POST data.
          var callbackURI = ( 'http://localhost:' + listenerPort + '/receive' )
          http.request(
            post,
            function(response) {
              test.equal(
                response.statusCode, 201,
                'POST /register to source responds 201')
              // Dispatch the callback data to all listeners registered with
              // the event source server.
              example.send(function(stream) {
                stream.end(CALLBACK_DATA) }) })
            .end(callbackURI) }) }) })
