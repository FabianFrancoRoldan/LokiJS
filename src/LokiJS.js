/**
 * LokiJS
 * @author Joe Minichino <joe@dsforge.net>
 * 
 * A lightweight document oriented javascript database
 */
'use strict';


var LokiJS = LokiJS || {};

LokiJS = {
	version : '0.0.1',
	/** @define {boolean} */
	DEBUG_MODE: true
};

function trace(message) { 
	try{
		if(LokiJS.DEBUG_MODE) console.log(message);
	}catch(err){
		/* no op */
	}
};


/**
 * Define library loki
 */
window.loki = (function(){

	/**
	 * @constructor
	 * The main database class
	 */
	function Loki(_name){
		try {
			var name = _name;
			trace('Creating db ' + name);

			var $getProperty = function(prop){ return prop; }
			this.getName = function(){
				return $getProperty.apply(this,['name']);
			};
		} catch(err) {
			trace(err);
		}	
	};

	/**
	 * @constructor 
	 * Collection class that handles documents of same type
	 */
	function Collection(_name, _objType){
		// the name of the collection 
		this.name = _name;
		// the data held by the collection
		this.data = [];
		// indices multi-dimensional array
		this.indices = [];
		// the object type of the collection
		this.objType = _objType || "";
		// pointer to self to avoid this tricks
		var coll = this;


		trace('Creating collection with name [' + this.name + '] of type [' + this.objType + ']');

		/**
		 * Add object to collection
		 */
		this.add = function(obj){

			// if parameter isn't object exit with throw
			if( 'object' != typeof obj ) {
				throw 'Object being added needs to be an object';
			}
			/*
			 * try adding object to collection
			 */
			if(coll.objType=="" && coll.data.length == 0){

				// set object type to that of the first object added to collection
				coll.objType = obj.objType;

			} else {
				
				// throw an error if the object added is not the same type as the collection's
				if(coll.objType!=obj.objType) {
					throw 'Object type [' + obj.objType + '] is incongruent with collection type [' + coll.objType +']';
				}
				if(coll.objType=="") {
					throw 'Object is not a model';
				}
				trace('Adding object ' + obj.toString() + ' to collection ' + coll.name);
				
				if(obj.id != null && obj.id > 0){
					throw 'Document is already in collection, please use update()';
				} else {
					obj.id = new Date().getTime();
					// add the object
					coll.data.push(obj);

					// resync indexes to make sure all IDs are there
					//coll.ensureAllIndexes();		
					for (var i = coll.indices.length - 1; i >= 0; i--) {
						coll.indices[i].data.push( obj[coll.indices[i].name ]);
					};
				}

			}
		};

		/**
		 * iterate through arguments and add indexes 
		 */
		this.addMany = function(){
			for(var i = 0; i < arguments.length; i++){
				coll.add(arguments[i]);
			}
		};

		/**
		 * generate document method - ensure objects have id and objType properties
		 */
		this.document = function(doc){
			trace('_objType : ' + coll.objType);
			trace(doc);
			doc.id == null;
			doc.objType = coll.objType;
			return doc;
		};

		/**
		 * Ensure indexes on a certain field
		 */
		this.ensureIndex = function(property){
			
			if (property == null || property === undefined) throw 'Attempting to set index without an associated property';	
			
			var index = {
				name : property,
				data : []
			};

			for(var i =0; i < coll.indices.length; i++){
				if( coll.indices[i].name == property){
					trace('Index ' + property + ' already exists, re-indexing....');
					index = coll.indices[i];
				} else {
					trace('Creating new index ' + property);
					
							
				}
			}

			coll.indices.push(index);
			delete index.data;

			index.data = new Array();
			for(var i =0; i < coll.data.length; i++){
				index.data.push( coll.data[i][index.name] );
				trace('Storing into index ' + index.name + ' value ' + index.data[i]);
			}
			trace( coll.indices );

		};

		/**
		 * Ensure index async with callback - useful for background syncing with a remote server 
		 */
		this.ensureIndexAsync = function(property, callback){
			trace('Calling ensureIndexAsync...');
			setTimeout( function(){
				coll.ensureIndex(property);
				callback();
			}, 1);
			trace('started indexing...');
		};

		/**
		 * Ensure all indexes
		 */
		this.ensureAllIndexes = function(){
			for (var i = coll.indices.length - 1; i >= 0; i--) {
				coll.ensureIndex(coll.indices[i].name);
			};
		};

		this.ensureAllIndexesAsync = function(callback){
			trace('Calling ensureAllIndexesAsync...');
			var callback = callback || coll.no_op;
			setTimeout( function(){ 
				coll.ensureAllIndexes();
				callback();
			}, 1 );
		};


		/**
		 * Find one object by index property
		 */
		this.findOne = function(prop, value){
			trace('Querying for ' + prop + '=' + value);
			var searchByIndex = false;
			var indexObject = null;

			// iterate the indices to ascertain whether property is indexed
			for(var i = 0; i < coll.indices.length; i++){
				if( coll.indices[i].name == prop){
					searchByIndex = true;
					indexObject = coll.indices[i];
					trace('Querying with index');
					trace(indexObject);
					break;
				}
			}
			
			if(searchByIndex){
				// perform search based on index
				var size = indexObject.data.length;
				for (var i = size - 1; i >= 0; i--) {
					
					if(indexObject.data[i] == value){
						var doc = coll.data[i];
						doc.__pos__ = i;
						return doc;
					}
				};;

			} else {
				// search all collection and find first matching result
				return coll.findOneUnindexed(prop, value);
			}
			return null;
		};

		/**
		 * Find object by unindexed field
		 */
		this.findOneUnindexed = function(prop, value){
			trace('Querying without index');
			for (var i = coll.data.length - 1; i >= 0; i--) {
				if(coll.data[i][prop]==value){
					var doc = coll.data[i];
					doc.__pos__ = i;
					return doc;
				}
				return null;
			};
		};

		/**
		 * Update method
		 */
		this.update = function(doc){

			// verify object is a properly formed document
			if(	doc.id == undefined || doc.id == null || doc.id < 0){
				throw 'Trying to update unsynced document. Please save the document first by using add() or addMany()';
			} else {

				var obj = coll.findOne('id', doc.id);
				trace(obj);
				// get current position in data array
				var position = obj.__pos__;
				delete obj.__pos__;
				// operate the update
				coll.data[position] = doc;
				// coll.ensureAllIndexes();
				for (var i = coll.indices.length - 1; i >= 0; i--) {
					coll.indices[i].data[position] = obj[ coll.indices[i].name ];
				};
			}
		};

		/**
		 * Delete function
		 */
		this.delete = function(doc){
			if('object' != typeof doc){
				throw 'Parameter is not an object';
			}

			if(doc.id == null || doc.id == undefined){
				throw 'Object is not a document stored in the collection';
			}
			trace('Deleting object...');
			trace(doc);
			var obj = coll.findOne('id', doc.id);
			var position = obj.__pos__;
			coll.data.splice(position,1);
			// coll.ensureAllIndexes();
			for (var i = coll.indices.length - 1; i >= 0; i--) {
				coll.indices[i].data.splice( position ,1);
			};

		};

		this.query = function(queryObject){

		};

		this.no_op = function(){
			trace('Operation completed.');
		};

		// initialize the id index
		coll.ensureIndex('id');
	};



	LokiJS.trace = trace.bind(LokiJS);
	Loki.prototype.Collection = Collection;

	return Loki;
}());