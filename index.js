/**
 * Module Dependencies
 */

var OrientDB = require('oriento');
var Errors = require('waterline-errors').adapter;
var JSON2 = require('JSON2');
var rest = require('restler');

function getSQLForUpdateJSONData(dbClass, action, json, options) {
    var first_condition = true;
    var sql = null;
    if (json && (action.toLowerCase() == "content") || (action.toLowerCase() == "merge")) {
        sql = "UPDATE " + dbClass + " " + action + " (" + json + ") RETURN AFTER";

        if (options && options.where) {
            var where_clause = "";
            for (var key in options.where) {
                if (key == 'null') {
                    continue;
                }
                val = options.where[key];
                if (!first_condition) {
                    where_clause += " AND";
                } else {
                    where_clause = " WHERE";
                    first_condition = false;
                }
                if (key == 'id') {
                    key = '@rid';
                    if ((typeof val == 'string') && (val[0] != '#')) {
                        val = '#' + val;
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
            sql += where_clause;
        }

        if (options && options.limit) {
            sql += " LIMIT " + options.limit;
        }

        if (options && options.lock) {
            if ((options.lock.toLowerCase() == "default") || (options.lock.toLowerCase() == "record")) {
                sql += " LOCK " + options.lock;
            }
        }

        if (options && options.timeout) {
            sql += " TIMEOUT " + options.timeout;
        }
    }
    return sql;
}
;

function getRESTFunctionURL(config, funcName) {
    if (config && funcName) {
        var url = "http://";
        un = config.db_username.replace("@", "%40");
        pswd = config.db_password.replace("@", "%40");
        url += un + ":" + pswd;
        url += "@";
        url += config.host + ":" + config.http_port;
        url += "/function/" + config.database + "/";
        if (funcName) {
            url += funcName;
        }
        return url;
    }
    return null;
}
;

module.exports = (function() {

    // We want to maintain a reference to each collection
    // (aka model) that gets registered with this adapter.
    var connections = {};
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
        registerConnection: function(connection, collections, cb) {
            if (!connection.identity)
                return cb(Errors.IdentityMissing);
            if (connections[connection.identity])
                return cb(Errors.IdentityDuplicate);

            var server = OrientDB(connection);
            _dbServer = server;
            if (server) {
                var db = server.use({
                    name: connection.database,
                    username: connection.db_username,
                    password: connection.db_password
                });
                if (db) {
                    // Store the connection
                    connections[connection.identity] = {
                        config: connection,
                        server: server,
                        db: db
                    };
                }
            }
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
        teardown: function(connectionName, cb) {
            if (!connectionName) {
                Object.keys(connections).forEach(function(conn) {
                    connections[conn].server.close();
                });
            } else {
                connections[connectionName].server.close();
            }
            //connections[connectionName].server.close();
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
        define: function(connectionName, collectionName, definition, cb) {
            // If you need to access your private data for this collection:
            var db = connections[connectionName].db;

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
        describe: function(connectionName, collectionName, cb) {
            // If you need to access your private data for this collection:
            var db = connections[connectionName].db;

            db.class.get(collectionName)
                    .then(function(dbClass) {
                        dbClass.property.list()
                                .then(function(properties) {
                                    cb(null, properties);
                                });
                    });
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
        drop: function(connectionName, collectionName, relations, cb) {
            // If you need to access your private data for this collection:

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
        find: function(connectionName, collectionName, options, cb) {
            var db = connections[connectionName].db;
            var params = {};

            sql = "SELECT FROM " + collectionName;
            first_condition = true;
            if (options && options.where) {
                for (var key in options.where) {
                    if (key == 'null') {
                        continue;
                    }
                    val = options.where[key];
                    if (!first_condition) {
                        sql += " AND";
                    } else {
                        first_condition = false;
                        sql += " WHERE";
                    }
                    if (key == 'id') {
                        key = '@rid';
                        if ((typeof val == 'string') && (val[0] != '#')) {
                            val = '#' + val;
                        }
                    }
                    if (typeof val == 'object') {
                        for (var op in val) {
                            value = val[op];
                            sql += " " + key + " " + op + " " + value;
                            continue;
                        }
                        continue;
                    }
                    sql += " " + key + " = '" + val + "'";
                }
            }

            if (options && options.skip) {
                sql += " SKIP " + options.skip;
            }

            if (options && options.limit) {
                sql += " LIMIT " + options.limit;
            }

            if (options && options.sort) {
                order_by = " ORDER BY";
                first_condition = true;
                for (var key in options.sort) {
                    val = options.sort[key];
                    if (val == 1) {
                        val = 'ASC';
                    } else if (val == -1) {
                        val = 'DESC';
                    } else {
                        continue;
                    }
                    if (!first_condition) {
                        order_by += ", ";
                    } else {
                        first_condition = false;
                    }
                    order_by += " " + key + " " + val;
                }
                if (order_by != " ORDER BY") {
                    sql += order_by;
                }
            }

            if (options && options.fetchPlan) {
                params.fetchPlan = options.fetchPlan;
            }
			
            db.query(sql, params)
                    .then(function(results) {
                        results = JSON2.decycle(results)
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
        create: function(connectionName, collectionName, values, cb) {
            // If you need to access your private data for this collection:
            var db = connections[connectionName].db;

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
            }
            if (sql) {
                db.query(sql)
                        .then(function(results) {
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
        update: function(connectionName, collectionName, options, values, cb) {

            // If you need to access your private data for this collection:
            var db = connections[connectionName].db;

            first_condition = true;
            if (options && options.where) {
                for (var key in options.where) {
                    if (key == 'null') {
                        continue;
                    }
                    val = options.where[key];
                    if (!first_condition) {
                        where_clause += " AND";
                    } else {
                        where_clause = " WHERE";
                        first_condition = false;
                    }
                    if (key == 'id') {
                        key = '@rid';
                        if ((typeof val == 'string') && (val[0] != '#')) {
                            val = '#' + val;
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

            if (options && options.limit) {
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

                db.query(sql)
                        .then(function(results) {
                            //call callback function with retrieved results
                            cb(null, results);
                        });
            } else {
                cb(null, []);
            }
        },
        insertJSONData: function(connectionName, collectionName, json, cb) {
            var db = connections[connectionName].db;
            var sql = "INSERT INTO " + collectionName + " CONTENT (" + json + ")";
            db.query(sql)
                    .then(function(results) {
                        //call callback function with retrieved results
                        cb(null, results);
                    });
        },
        /*
         * This replaces a content / record(s) / document(s) with new  given data (json)
         * 
         * @param {type} connectionName
         * @param {type} collectionName
         * @param {type} json
         * @param {type} options
         * @param {type} cb
         * @returns {undefined}
         */
        replaceJSONData: function(connectionName, collectionName, json, options, cb) {
            var db = connections[connectionName].db;
            var sql = getSQLForUpdateJSONData(collectionName, "content", json, options)
            if (sql) {
                db.query(sql)
                        .then(function(results) {
                            //call callback function with retrieved results
                            cb(null, results);
                        });
            } else {
                cb(null, {});
            }
        },
        /*
         * This merges / (adds or edit) the existing content / record(s) / doument(s) with new given data (json)
         * 
         * @param {type} connectionName
         * @param {type} collectionName
         * @param {type} json
         * @param {type} options
         * @param {type} cb
         * @returns {undefined}
         */
        mergeJSONData: function(connectionName, collectionName, json, options, cb) {
            var sql = getSQLForUpdateJSONData(collectionName, "merge", json, options)
            var db = connections[connectionName].db;
            if (sql) {
                db.query(sql)
                        .then(function(results) {
                            //call callback function with retrieved results
                            cb(null, results);
                        });
            } else {
                cb(null, {});
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
        destroy: function(connectionName, collectionName, options, cb) {
            // If you need to access your private data for this collection:
            var db = connections[connectionName].db;

            var sql = "DELETE FROM " + collectionName;
            var first_condition = true;
            if (options && options.where) {
                for (var key in options.where) {
                    if (key == 'null') {
                        continue;
                    }
                    val = options.where[key];
                    if (!first_condition) {
                        sql += " AND";
                    } else {
                        sql += " WHERE";
                        first_condition = false;
                    }
                    if (key == 'id') {
                        key = '@rid';
                        if ((typeof val == 'string') && (val[0] != '#')) {
                            val = '#' + val;
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

            if (options && options.limit) {
                sql += " LIMIT " + options.limit;
            }

            db.query(sql)
                    .then(function(results) {
                        //call callback function with retrieved results
                        cb(null, results);
                    });
        },
        /**
         *
         * REQUIRED method if users expect to call Model.callDBFunction()
         * 
         * @param  {[type]}   collectionName [description]
         * @param  {[type]}   options        [description]
         * @param  {Function} cb             [description]
         * @return {[type]}                  [description]
         */
        callDBFunction: function(connectionName, collectionName, options, cb) {

            if (options) {
                if (options.protocol && (options.protocol.toLowerCase()) == "binary") {
                    // Call function using binary protocol
                    var db = connections[connectionName].db;
                    var sql = null;

                    if (options.funcName) {
                        sql = "SELECT " + options.funcName + "(";
                        first_condition = true;
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
                        db.query(sql)
                                .then(function(results) {
                                    //call callback function with retrieved results
                                    cb(null, results);
                                });
                    } else {
                        cb(null, []);
                    }
                } else {
                    // Call function using HTTP/REST protocol
                    if (options.funcName) {
                        //options.funcName = "getuser";
                        var url = getRESTFunctionURL(connections[connectionName].config, options.funcName);
                        if (!(options.method)) {
                            options.method = "POST"     // defaulting to POST
                        }
                        if (!(options.params)) {
                            options.params = {}     // defaulting to blank JSON object
                        }
                        switch (options.method) {
                            case "GET":
                                if (options.params && (typeof (options.params) == "object")) {
                                    queryStr = "";
                                    for (key in options.params) {
                                        queryStr += "/" + options.params[key];
                                    }
                                    if (queryStr != "") {
                                        url = url + queryStr;
                                    }
                                }
                                rest.get(url).on('complete', function(data, response) {
                                    if (response.statusCode == 200) {
                                        cb(null, data);
                                    } else {
                                        err = {
                                            code: response.statusCode,
                                            message: response.rawEncoded
                                        };
                                        cb(err, []);
                                    }
                                });
                                break;
                            case "POST":
                                rest.postJson(url, options.params).on('complete', function(data, response) {
                                    if (response.statusCode == 200) {
                                        cb(null, data);
                                    } else {
                                        response = JSON2.decycle(response);
                                        err = {
                                            code: response.statusCode,
                                            message: response.rawEncoded
                                        };
                                        cb(err, []);
                                    }
                                });
                                break;
                            case "PUT":
                                rest.putJson(url, options.params).on('complete', function(data, response) {
                                    if (response.statusCode == 200) {
                                        cb(null, data);
                                    } else {
                                        response = JSON2.decycle(response);
                                        err = {
                                            code: response.statusCode,
                                            message: response.rawEncoded
                                        };
                                        cb(err, []);
                                    }
                                });
                                break;
                            case "DELETE":
                                // TODO - Not yet implemented
                                cb(null, []);
                                break;
                            default:
                                cb(null, []);
                                break;
                        }
                    } else {
                        cb(null, []);
                    }
                }
            }
        },
    };

    // Expose adapter definition
    return adapter;

})();

