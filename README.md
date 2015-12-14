This package exports a constructor for objects that manage HTTP callback endpoints.

Would-be event callback recipient POSTs to a receptive endpoint on the event generating server. The body of that request includes only the endpoint URL where the event-generating server should POST when an event occurs. The protocol may be HTTP or HTTPS.

The event-generating server sends the same data to all registered callback endpoints. By default, the event-generating server will retry callbacks. Retry is configurable. Callback endpoints that fail to respond with 2xx status codes despite retry are removed from the list of callback endpoints for future events.
