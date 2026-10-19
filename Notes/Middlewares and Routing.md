Middleware are functions or operations that are performed before recieving a request and between sending a response.
next() is is used to pass the control to the next middleware 
For eg:
Multer Middleware : this middleware uses disk storage to store an uploaded file which may be used in a controller
Auth Middleware: this is used to authenticate the user by checking if the access token is present in cookies or not. Then it can store the id of authenticated user in req.user. This id may be used for multiple reasons in a controller
app.use(): We are using this to configure a lot of things like cors, cookies, etc.

