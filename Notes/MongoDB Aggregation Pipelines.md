MongoDb aggregation pipline has stages. 
Each stage filters documents from collection based on th operation we are performing

```
1. Get active users from a collection of user:
   
   [
	   {
		   $match: {
			   isActive:true
		   }
	   },
	   {
		   $count: "activeUsers"
	   }
	   
   ]
```
  First match will collect or aggregate all the documents that has isActive set to true 
  Then $count will count the number of documents
  Each one of them is a stage
  Next stage will get the result of previous operation 

```
2. Finding average age of the users
   
   [
		{
			$group:{
				_id: null,
				averageAge: {
					$avg: "$age"
				}
			},			
		}
   ]
```
First we group all the documents by giving the id as null. Passing the id as null will aggregate the documents


```
export const getPostBySlug = async function (req, res, next) {

try {

let currUser = req.user ? req.user._id : null;
const { slug } = req.params;  
const post = await Post.aggregate([
	{
		$match: { slug, status: "published" },
	
	},
	{
		$lookup: {	
		from: "users",	
		localField: "authorId",	
		foreignField: "_id",	
		as: "author",
		pipeline: [
			{
				$project: {
					username: 1,
					fullName: 1,
					avatar: 1,
					followersCount: 1,
				},
			},
		],
		},
	},
	{
		$set: {
			author: { $first: "$author" },
		},
	},

```

In get Post By Sulg we want:
1. Post that matches the slug and is also published
2. We need to get the information of the author of the post that we are getting
For these two requirements we are making an aggregation pipeline that get the document we want by using $match 
Now for the second part we are using $lookup,
This will lookup for the author in the current post in user collection and return an array with the document found
But we use $project to get only the necessary info
In the third pipline we are just adding a field nammed author which by extracting the first value of array we got from the previous field

```
{
	$lookup: {
		from: "follows",
		let: { authorId: "$author._id", userId: currUser },	
		pipeline: [
			{
				$match: {				
					$expr: {
						$and: [
							{ $ne: ["$$userId", null] },
							{ $eq: ["$followerId", "$$userId"] },
							{ $eq: ["$followingId", "$$authorId"] },
						],
					},
				},
			},	
		],
		as: "followData",	
	},
},
{
	$set: {
		"author.isFollowing": {
			$gt: [{ $size: "$followData" }, 0],
		},
	}
},
```

Goal: 
1. To add a field that is follow data which will tell whether the current logged in user follows the author of the post we are getting
2. Then set the isFollowing true or false based on the length os follow data is greater than 0 or not
To approach this we need to understand how we have built our models. There is da follow model which stores the information of who follows who 
    A--------------follows---------------> B
*(followerId)                                              (followingId)*

Now using this model we can find whether current user follows the author of of this post 
We are using let to set a variable for authorId of current post as a variable because when we get into the second pipeline we will be in the follows model and we will not be able to have access of authorId of current post 

So we have to make a check whether the currentUser is present in followerId of follows model and authorId in followingId of the follows model. So the basically the relationship we are searching for is: 
	currentUser-------------follows---------------> authorOfCurrentPost
    *(followerId)                                                                    (followingId)*

After that we are just checking if the current rel is found or not by checking if the followData has 0 length or not
And setting isFollowing field true or false in author based on that 