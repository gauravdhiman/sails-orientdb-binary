/**
 * Module Dependencies
 */

var OrientDB = require('oriento');

module.exports = (function () {

  // We want to maintain a reference to each collection
  // (aka model) that gets registered with this adapter.
  var _modelReferences = {};
  var _dbPools = [];
  var _dbServer = null;

  var adapter = {
	identity: 'sails-orientdb',
    syncable: false,
    // Default configuration for collections
    // (same effect as if these properties were included at the top level of the model definitions)
    defaults: {
		// IMPORTANT:
		// `migrate` is not a production data migration solution!
		// In production, always use `migrate: safe`
		//
		// drop   => Drop schema and data, then recreate it
		// alter  => Drop/add columns as necessary.
		// safe   => Don't change anything (good for production DBs)
		migrate: 'safe'
    },

    /**
     * 
     * This method runs when a model is initially registered
     * at server-start-time.  This is the only required method.
     * 
     * @param  {[type]}   collection [description]
     * @param  {Function} cb         [description]
     * @return {[type]}              [description]
     */
    registerCollection: function(collection, cb) {
		// Keep a reference to this collection
		_modelReferences[collection.identity] = collection;
		var server = OrientDB(collection.config);
		_dbServer = server;
		var db = server.use({
		name: collection.config.database,
		username: collection.config.db_username,
		password: collection.config.db_password
		});
		_dbPools[collection.config] = {};
		_dbPools[collection.config].db = db;
		_dbPools[collection.config].config = collection.config;
		// Call callback function
		cb();
    },


    /**
     * Fired when a model is unregistered, typically when the server
     * is killed. Useful for tearing-down remaining open connections,
     * etc.
     * 
     * @param  {Function} cb [description]
     * @return {[type]}      [description]
     */
    teardown: function(cb) {
		_dbServer.close();
		console.log ('Closing DB server connection.');
		cb();
    },



    /**
     * 
     * REQUIRED method if integrating with a schemaful
     * (SQL-ish) database.
     * 
     * @param  {[type]}   collectionName [description]
     * @param  {[type]}   definition     [description]
     * @param  {Function} cb             [description]
     * @return {[type]}                  [description]
     */
    define: function(collectionName, definition, cb) {
		// If you need to access your private data for this collection:
		var collection = _modelReferences[collectionName];
		var db = _dbPools[collection.config].db;

		// Define a new "table" or "collection" schema in the data store
		cb();
    },

    /**
     *
     * REQUIRED method if integrating with a schemaful
     * (SQL-ish) database.
     * 
     * @param  {[type]}   collectionName [description]
     * @param  {Function} cb             [description]
     * @return {[type]}                  [description]
     */
    describe: function(collectionName, cb) {
		// If you need to access your private data for this collection:
		var collection = _modelReferences[collectionName];
		var db = _dbPools[collection.config].db;

		// Respond with the schema (attributes) for a collection or table in the data store
		var attributes = {};
		cb(null, attributes);
    },


    /**
     *
     *
     * REQUIRED method if integrating with a schemaful
     * (SQL-ish) database.
     * 
     * @param  {[type]}   collectionName [description]
     * @param  {[type]}   relations      [description]
     * @param  {Function} cb             [description]
     * @return {[type]}                  [description]
     */
    drop: function(collectionName, relations, cb) {
		// If you need to access your private data for this collection:
		var collection = _modelReferences[collectionName];
		var db = _dbPools[collection.config].db;

		// Drop a "table" or "collection" schema from the data store
		cb();
    },

    /**
     * 
     * REQUIRED method if users expect to call Model.find(), Model.findOne(),
     * or related.
     * 
     * You should implement this method to respond with an array of instances.
     * Waterline core will take care of supporting all the other different
     * find methods/usages.
     * 
     * @param  {[type]}   collectionName [description]
     * @param  {[type]}   options        [description]
     * @param  {Function} cb             [description]
     * @return {[type]}                  [description]
     */
    find: function(collectionName, options, cb) {
		// If you need to access your private data for this collection:
		var collection = _modelReferences[collectionName];
		var db = _dbPools[collection.config].db;

		// Options object is normalized for you:
		// 
		// options.where
		// options.limit
		// options.skip
		// options.sort

		// Filter, paginate, and sort records from the datastore.
		// You should end up w/ an array of objects as a result.
		// If no matches were found, this will be an empty array.

		// Respond with an error, or the results.
		console.log(options);
		sql = "SELECT FROM " + collectionName;
		first_condition = true;
		if (options.where) {
			sql += " WHERE";
			for (var key in options.where) {
				val = options.where[key];
				if (!first_condition) {
					sql += " AND";
				} else {
					first_condition = false;
				}
				if (key == 'id') {
					key = '@rid';
					if ((typeof val == 'string') && (val[0] != '#')) {
						val = '#'+val;
					}
				}
				if (typeof val == 'object') {
					for (var op in val) {
						value = val[op];
						sql += " " + key + " " + op + " '" + value + "'";
						continue;
					}
					continue;
				}
				sql += " " + key + " = '" + val + "'";
			}
		}
		
		if (options.skip) {
			sql += " SKIP " + options.skip;
		}
		
		if (options.limit) {
			sql += " LIMIT " + options.limit;
		}
		
		if (options.sort) {
			order_by = " ORDER BY";
			for (var key in options.sort) {
				val = options.sort[key];
				if (typeof val != 'string') {
					continue;
				}
				if (val.toUpperCase() == 'DESC') {
					val = 'DESC';
				} else {
					val = 'ASC';
				}
				order_by += " " + key + " " + val;
			}
			if (order_by != " ORDER BY") {
				sql += order_by;
			}
		}
		
		if (options.fetchplan) {
			sql += " FETCHPLAN " + options.fetchplan;
		}
		sql += ";";
		console.log("Sending query - " + sql);
		  
		db.query(sql)
		.then(function (results) {
			//call callback function with retrieved results
			cb(null, results);
		});
    },
	
    /**
     *
     * REQUIRED method if users expect to call Model.create() or any methods
     * 
     * @param  {[type]}   collectionName [description]
     * @param  {[type]}   values         [description]
     * @param  {Function} cb             [description]
     * @return {[type]}                  [description]
     */
    create: function(collectionName, values, cb) {
		// If you need to access your private data for this collection:
		var collection = _modelReferences[collectionName];
		var db = _dbPools[collection.config].db;

		first_val = true;
		fields = "";
		vals = "";
		if (Object.keys(values).length > 2) {
			for (var field in values) {
				val = values[field];
				if (!first_val) {
					fields += ", ";
					vals += ", ";
				} else {
					first_val = false;
				}
				fields += "'" + field + "'";
				vals += "'" + val + "'";
			}
			sql = "INSERT INTO " + collectionName + "(" + fields + ") VALUES (" + vals + ")";
			console.log(sql);
		}
		if (sql) {
			db.query(sql)
			.then(function (results) {
				//call callback function with retrieved results
				cb(null, results);
			});
		} else {
			cb(null, {});
		}
    },


    /**
     *
     * 
     * REQUIRED method if users expect to call Model.update()
     *
     * @param  {[type]}   collectionName [description]
     * @param  {[type]}   options        [description]
     * @param  {[type]}   values         [description]
     * @param  {Function} cb             [description]
     * @return {[type]}                  [description]
     */
    update: function(collectionName, options, values, cb) {

		// If you need to access your private data for this collection:
		var collection = _modelReferences[collectionName];
		var db = _dbPools[collection.config].db;
		
		first_condition = true;
		if (options.where) {
			where_clause = " WHERE";
			for (var key in options.where) {
				val = options.where[key];
				if (!first_condition) {
					where_clause += " AND";
				} else {
					first_condition = false;
				}
				if (key == 'id') {
					key = '@rid';
					if ((typeof val == 'string') && (val[0] != '#')) {
						val = '#'+val;
					}
				}
				if (typeof val == 'object') {
					for (var op in val) {
						value = val[op];
						where_clause += " " + key + " " + op + " '" + value + "'";
						continue;
					}
					continue;
				}
				where_clause += " " + key + " = '" + val + "'";
			}
		}
		
		if (options.limit) {
			limit_cond = " LIMIT " + options.limit;
		}

		first_val = true;
		fields = "";
		if (Object.keys(values).length > 1) {
			for (var field in values) {
				val = values[field];
				if (!first_val) {
					fields += ", ";
				} else {
					first_val = false;
				}
				fields += field + " = '" + val + "'";
			}
		}
		
		if (fields) {
			sql = "UPDATE " + collectionName + " SET " + fields;
			if (where_clause) {
				sql += where_clause;
			}
			if (limit_cond) {
				sql += limit_cond;
			}
			console.log(sql);
			db.query(sql)
			.then(function (results) {
				//call callback function with retrieved results
				cb(null, results);
			});
		} else {
			cb(null, []);
		}
    },
 
    /**
     *
     * REQUIRED method if users expect to call Model.destroy()
     * 
     * @param  {[type]}   collectionName [description]
     * @param  {[type]}   options        [description]
     * @param  {Function} cb             [description]
     * @return {[type]}                  [description]
     */
    destroy: function(collectionName, options, cb) {
		// If you need to access your private data for this collection:
		var collection = _modelReferences[collectionName];
		var db = _dbPools[collection.config].db;
		console.log(options);

		var sql = "DELETE FROM " + collectionName;
		var first_condition = true;
		if (options.where) {
			sql += " WHERE";
			for (var key in options.where) {
				val = options.where[key];
				if (!first_condition) {
					sql += " AND";
				} else {
					first_condition = false;
				}
				if (key == 'id') {
					key = '@rid';
					if ((typeof val == 'string') && (val[0] != '#')) {
						val = '#'+val;
					}
				}
				if (typeof val == 'object') {
					for (var op in val) {
						value = val[op];
						sql += " " + key + " " + op + " '" + value + "'";
						continue;
					}
					continue;
				}
				sql += " " + key + " = '" + val + "'";
			}
		}
		
		if (options.limit) {
			sql += " LIMIT " + options.limit;
		}
		console.log(sql);
		db.query(sql)
		.then(function (results) {
			//call callback function with retrieved results
			cb(null, results);
		});
    },


    /*
    **********************************************
    * Custom methods
    **********************************************

    // Custom methods defined here will be available on all models
    // which are hooked up to this adapter:
    //
    // e.g.:
    //
    foo: function (collectionName, options, cb) {
      return cb(null,"ok");
    },
    bar: function (collectionName, options, cb) {
      if (!options.jello) return cb("Failure!");
      else return cb();
    }

    // So if you have three models:
    // Tiger, Sparrow, and User
    // 2 of which (Tiger and Sparrow) implement this custom adapter,
    // then you'll be able to access:
    //
    // Tiger.foo(...)
    // Tiger.bar(...)
    // Sparrow.foo(...)
    // Sparrow.bar(...)


    // Example success usage:
    //
    // (notice how the first argument goes away:)
    Tiger.foo({}, function (err, result) {
      if (err) return console.error(err);
      else console.log(result);

      // outputs: ok
    });

    // Example error usage:
    //
    // (notice how the first argument goes away:)
    Sparrow.bar({test: 'yes'}, function (err, result){
      if (err) console.error(err);
      else console.log(result);

      // outputs: Failure!
    })


    

    */
	callDBFunction: function (collectionName, options, cb) {
		// If you need to access your private data for this collection:
		var collection = _modelReferences[collectionName];
		var db = _dbPools[collection.config].db;
		console.log(options);
		console.log(cb);

		if (options.funcName) {
			sql = "SELECT " + options.funcName + "(";
			first_condition= true;
			for (var key in options.params) {
				val = options.params[key];
				if (!first_condition) {
					sql += ",";
				} else {
					first_condition = false;
				}
				sql += " '" + val + "'";
			}
			sql += ")";
			// wrap in outer select query
			sql = "SELECT expand(" + options.funcName + ") from  (" + sql + ")";
		}
		if (sql) {
			console.log(sql);
			db.query(sql)
			.then(function (results) {
				//call callback function with retrieved results
				cb(null, results);
			});
		} else {
			cb(null, []);
		}
    },

  };


  // Expose adapter definition
  return adapter;

})();

