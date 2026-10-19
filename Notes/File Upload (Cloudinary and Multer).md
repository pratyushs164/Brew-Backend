Cloudinary and multer are dependencies we use in uploading a file.

==Multer== is an express middleware that isused to handle multipart/form-data and processes uploaded file. When configured with disk storage, it temporarily stores the uploaded file on server.
==Cloudinary== is a cloud service which stores the images we upload permanently

**How we use these two dependencies to upload files and why do we need both of them:**
1. We can directly upload our image to cloudinary and get the url from there 
2. But for as a good practice we temporarily store it in local storage using multer as a middleware so that the user can get a chance to reupload.
3. Therefore before making a post request of /register to register the user we put the multer middleware to upload the given image in local storage.
4. Then while we create the controller for registr user we can access the local path of this file using req.files.path.
5. We can use this path to upload the file on cloudinary.
6. Remember to use fs (a core node library that is used for accessing file system) to unlink/ delete the file from local storage after being uploaded on cloudinary