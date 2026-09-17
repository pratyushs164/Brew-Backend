#### ==Refresh Token & Access Token==
We store two secret tokens in our .env named refresh token secret and acess token secret. These are long string of random characters which are used to as Signing secrets while creating jwt
==Refresh Token== is long lived token and 
==Access Token== is short lived token.
Other than that both of them have nostly same use case of authentication the user
Session could have been defined using one token also but it has now become a standard practice and a good security measure to define two tokens.
With the help of refresh token we can verify the user for a long term but we use access token to i.e. a short lived token to refresh after a short time so that there is less risk of expoure of this secret keys.
We can either ask the user to login again after the expiry of access token or we can use the refresh token to verify the user and automatically generate new access token.
Then after the refresh token has expired,  the session of user is over and we ask the user to login again.
In summary access token is a short lived token and refresh token is used to refresh it so that user do not have to login again and again. Also if access token is compromise it has less duration of usability.
#### ==JWT==:
We need a standard way to create and verify these tokens there we use JWT
Parameters we generally provide to jwt:
- Payload: data that we want to store in token
- Secet: Used to sign the token
- Expiration Time: Time after which the token will expire

JWT encodes the payload and signs it.
By signing we can verify that the payload is still valid or not.
Note that signing does not mean that the payload is encrypted.

jwt.sign(): By using this we sign the payload
jwt.verify(): By using this we verify that the signed payload is still valid or not. For eg. if the refresh token has been expired or not
#### ==Cookies==:
Cookies are used to store the refresh and access token.
These cookies are sent to the frontend but we usually setup them in such a way that they are only modified from server.
 



