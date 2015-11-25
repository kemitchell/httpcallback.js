This package exports a constructor for objects that manage HTTP callback endpoints.

Would-be event callback recipient send POST requests to receptive endpoints on the event-generating server. The body of that request includes only the URL where the event-generating server should POST when an event occurs. The URL may specific HTTP or HTTPS.

The event-generating server sends the same data to all registered callback endpoints. By default, the event-generating server will retry callbacks as configured. Callback endpoints that fail to respond with 2xx status codes are deregistered from the list of callback endpoints for future events.
