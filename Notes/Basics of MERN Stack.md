File Structure 
Express js - res and req
Database and orms 
Database Modelling



### ==**FILE STRUCTURE:**==
1. We put everything in the src folder
2. We make folders named controllers, middlwares, db, routes, utils, models
3. There is no hard and fast rules for making folders but these are the standards that are followed
4. ==CONTROLLERS==: These are used to define the various functions that are needed to be performed while handling various requests. Controllers communicate with database to view, updated, delete etc data and defines how we want to send res and how we handle requests. The function recieves requests, perform required operation and sends response.
5. ==MIDDLEWARES==: Middlewares are an added layer that is accessed in the request response cycle. Middlware passes control to the next middleware so that it can perform its action once the previous one is done. For example authentication,  verification, handling errors, etc 
6. ==ROUTES==: These are used to define routes of various requests
7. ==MODELS==:They are used to define the structure of application's data and provide a platform to interact with database
8. ==db==: Used to connect server and databse using odm like mongoose
9. ==UTILS==: These are helper functions



### **==EXPRESS JS==**

This is a library built over node.js that has variuos methods to handle request and response. It handles various requests like get, post, put, etc using request and response parameters. Each request can be handled on desired route using two parameters request and response.
They are used to read the req recieved and send the response in the desired format.
Routes can be deifined using express and thus we can define the endpoints and controller to be used on the specified endpoint.

