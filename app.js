var express = require('express');
var bodyParser = require('body-parser');
var settings = require('./settings');
var Datastore = require('nedb');
var _ = require('lodash');
var async = require('async');

var hosts = new Datastore({ filename: './.db/hosts', autoload: true });

(function cleanup() {
  hosts.find({}, function (err, docs) {
    if (err) { console.error(err); }

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
    });
  }
);

app.listen(settings.get('port'), function () {
  var rinfo = this.address();
  var address = rinfo.address;
  var port = rinfo.port;
  console.log('Server bound to %s, and listening on port %s', address, port);
});