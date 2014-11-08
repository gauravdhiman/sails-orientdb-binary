![image_squidhome@2x.png](http://i.imgur.com/RIvu9.png) 

# sails-orientdb adapter

This is a waterline ORM adapter which connects SailsJS app to OrientDB data store. It implements basic CRUD operations on OrientDB using both Binary and REST/HTTP protocols.
NOTE: Although the name of this package specifies 'binary', but it supports both protocols (Binary + REST). NPM name was taken when REST support was not implemented, hence the old name continues.


> ### WARNING
>
> This version of the adapter is for the v0.10+ release of Sails / Waterline. It should work with latest Sails version.



## Installation
Install from NPM.

```bash
# In your app:
$ npm install sails-orientdb-binary
```


## Sails Configuration

Add the OrientDB config to the config/adapters.js file.  Basic options:

```javascript
module.exports.adapters = {
  'default': 'orientdb-bin',

  orientdb-bin: {
    module   : 'sails-orientdb-binary',
    host     : 'localhost',
    port     : 3306,
    user     : 'username',
    password : 'password',
    database : 'OrientDB Database Name'
  }
};
```


## Communicate with OrientDB using Binary & REST Protocols

Using this adapter you can do below CRUD operations on OrientDB classes over binary protocol.

#### Find: Select record(s) from OrientDB collection / class / table
Example usage: Below example find all those User records where id (in OrientDB its @rid - primary key) is #5:3 and name attribute is 'mike'

```javascript
User.find({
	where: {
		id: '#5:3',
		name: 'mike'
	}
})
.exec(function (err, result) {
	if (err) {
		console.log("Something went wrong");
	} else {
		console.log("Returned result from server:");
		console.log(result);
		res.json(result);
	}
});
```


#### Insert: Add new record to OrientDB collection / class / table
Example usage: Below example inserts new record with four attributes / fields in User collection

```javascript
User.create({
	name: 'Mike',
	firstName: 'Mike',
	lastName: 'Tyson',
	mobieNumber: '1-805-345-xxx'
})
.exec(function (err, result) {
	if (err) {
		console.log("Something went wrong");
	} else {
		console.log("Record added !");
		res.json(result);
	}
});
```


#### Update: Update / change existing record(s) in OrientDB collection / class / table
Example usage: Below example will update lastName and mobileNumber attributes of max 5 records where firstName starts with 'Mike' and email is 'mike@tyson.com'

```javascript
User.update(
	{
		where:{
			firstName: {
				'LIKE': 'Mike'
			},
			email: 'mike@tyson.com'
		},
		limit: 5
	},
	{
		lastName: 'Luther',
		mobileNumber: '1-304-555-xxx'
	}
)
.exec(function (err, result) {
	if (err) {
		console.log("Something went wrong");
	} else {
		console.log("Record updated !");
		res.json(result);
	}
});
```


#### Destroy: Delete existing record(s) in OrientDB collection / class / table
Example usage: Below example will delete max 5 records where firstName starts with 'Mike' and email is 'mike@tyson.com'

```javascript
User.destroy(
	{
		where:{
			firstName: {
				'LIKE': 'Mike'
			},
			email: 'mike@tyson.com'
		},
		limit: 5
	}
)
.exec(function (err, result) {
	console.log("deleted !");
	console.log(result);
	res.json(result);
});
```


#### callDBFunction: OrientDB allows you to write function in javascript or SQL which work very similar to stored procedures. We can call such defined function using callDBFunction method of this adapter.
Example usage: Below example calls the defined OrientDB functions getAllStates() with parameter 'India'.

##### Calling function over Binary Protocol:

```javascript
User.callDBFunction(
	{
		funcName:"getAllStates",
		params: {
			countryName: "India"
		}
	},
	function (err, result) {
		console.log("Function called !");
		console.log(result);
		res.json(result);
	}
);
```

##### Calling OrientDB function over REST / HTTP protocol

```javascript
var options = {
	funcName: "addUser",
	protocol: "http",
	method: "POST",
	params: {
		firstName: 'Mike',
		lastName: 'Tyson',
		email: 'mike@tyson.com'
	}
};

Users.callDBFunction(options, function(err, results) {
	var user;
	if (err) {
		res.json(err.code, err.message);
	} else {
		users = results.result;
		res.json(users);
	}
});
```


## Waterline

[Waterline](https://github.com/balderdashy/waterline) is a brand new kind of storage and retrieval engine.

It provides a uniform API for accessing stuff from different kinds of databases, protocols, and 3rd party APIs. That means you write the same code to get users, whether they live in MySQL, OrientDB, LDAP, MongoDB, or Facebook.


#### License

**[MIT](./LICENSE)**
&copy; 2014
[Gaurav Dhiman](https://www.linkedin.com/in/gauravdhiman), [TechZulla](http://techzulla.com) & contributors

[Sails](http://sailsjs.org) is free and open-source MVC framework based on [NodeJS] (http://nodejs.org/). It is licensed under the [MIT License](http://sails.mit-license.org/).
[OrientDB](http://www.orientechnologies.com/orientdb/) is free and open-source under the [Apache 2](http://www.apache.org/licenses/LICENSE-2.0.html). As its open-source, you can get its sources [here] (https://github.com/orientechnologies/orientdb)
