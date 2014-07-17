var express = require('express');
var bodyParser = require('body-parser');
var settings = require('./settings');
var Datastore = require('nedb');
var _ = require('lodash');
var async = require('async');

var hosts = new Datastore({ filename: './.db/hosts', autoload: true });

var timeToLive = settings.get('ttl') || 1000 * 60 * 60 * 24 * 10;

(function cleanup() {
  hosts.find({}, function (err, docs) {
    if (err) { console.error(err); }
    async.each(docs, function (doc, callback) {
      if (new Date() - doc.created > timeToLive) {
        return hosts.remove({_id: doc._id}, {}, function (err, numRemoved) {
          if (!err && numRemoved) {
            console.log('%s: host, %s, with name "%s", removed', new Date().toString(), doc.address, doc.name);
          }
          callback(null);
        });
      }
      setImmediate(function () {
        callback(null);
      });
    }, function () {
      setTimeout(function () {
        cleanup();
      }, 10000);
    });
  });
}());

var app = express();

app.use(bodyParser.json());

function onlyJSON(req, res, next) {
  if (req.get('Content-Type') !== 'application/json') {
    return res.json(400, { 'message': 'We only accept JSON' });
  }
  next();
}

app.get(
  '/hosts',
  function (req, res, next) {
    hosts.find({}, function (err, docs) {
      if (err) { return next(err); }
      res.json(docs.map(function (doc) {
        return _.pick(doc, 'name', 'address', 'created');
      }));
    });
  }
);

app.get(
  '/hosts/:name',
  function (req, res, next) {
    hosts.find({ name: req.params.name }, function (err, docs) {
      if (err) { return next(err); }
      res.json(_.pick(docs[0], 'name', 'address', 'created'));
    });
  }
);

app.post(
  '/hosts',
  onlyJSON,
  function (req, res, next) {
    if (!req.body.name) {
      return res.json(400, {'message': 'Missing name field'});
    }

    var search = _.pick(req.body, 'name');
    var toUpsert = _.assign(
      {},
      search,
      { address: req.connection.remoteAddress },
      { created: new Date() }
    );

    hosts.update(search, toUpsert, { upsert: true }, function (err, numReplaced, upsert) {
      if (err) { return next(err); }
      res.json(201, {message: 'Success!'});
      console.log('%s: host %s, with name "%s", added', new Date().toString(), req.body.name, req.connection.remoteAddress);
    });
  }
);

app.listen(settings.get('port') || 6000, function () {
  var rinfo = this.address();
  var address = rinfo.address;
  var port = rinfo.port;
  console.log('Server bound to %s, and listening on port %s', address, port);
});
