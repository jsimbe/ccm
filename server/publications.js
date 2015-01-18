var userFieldsToPublish = {
  emails: 1,
  profile: 1,
  siteAdmin: 1,
};
Meteor.publish(null, function() {
  if(!this.userId) {
    return [];
  }
  return Meteor.users.find({
    _id: this.userId,
  }, {
    fields: userFieldsToPublish,
  });
});

var getCompetitions = function() {
  return Competitions.find(
    {},
    { fields: { wcaCompetitionId: 1, competitionName: 1, listed: 1 } }
  );
};
Meteor.publish('competitions', function() {
  return getCompetitions();
});

HTTP.publish({collection: Competitions}, function(data) {
  return getCompetitions();
});

function competitionUrlIdToId(competitionUrlId) {
  var competition = Competitions.findOne({
    $or: [
      { _id: competitionUrlId },
      { wcaCompetitionId: competitionUrlId },
    ]
  }, {
    fields: {
      _id: 1,
    }
  });
  if(!competition) {
    return null;
  }
  return competition._id;
}

Meteor.publish('competition', function(competitionUrlId) {
  check(competitionUrlId, String);
  var competitionId = competitionUrlIdToId(competitionUrlId);
  if(!competitionId) {
    return [];
  }

  var cursors = [
    Competitions.find({ _id: competitionId }),
    Rounds.find({ competitionId: competitionId }),
  ];
  if(this.userId) {
    // Always publish the users registration, as that lets us know if they are
    // staff and/or an organizer.
    cursors.push(
      Registrations.find({ competitionId: competitionId, userId: this.userId })
    );
  }
  return cursors;
});

Meteor.publish('competitionUsers', function(competitionUrlId) {
  check(competitionUrlId, String);
  var competitionId = competitionUrlIdToId(competitionUrlId);
  if(!competitionId) {
    return [];
  }
  return [
    Registrations.find({ competitionId: competitionId }),
  ];
});

Meteor.publish('competitionRegistrationGuestCounts', function(competitionUrlId) {
  check(competitionUrlId, String);
  var competitionId = competitionUrlIdToId(competitionUrlId);
  if(!competitionId) {
    return [];
  }
  return [
    Registrations.find({competitionId: competitionId}, {fields: { guestCount: 1 }})
  ];
});

Meteor.publish('competitorResults', function(competitionUrlId, competitorUniqueName) {
  check(competitionUrlId, String);
  check(competitorUniqueName, String);
  var competitionId = competitionUrlIdToId(competitionUrlId);
  if(!competitionId) {
    return [];
  }
  var registration = Registrations.findOne({
    competitionId: competitionId,
    uniqueName: competitorUniqueName,
  });
  if(!registration) {
    return [];
  }
  return [
    Registrations.find({competitionId: competitionId, uniqueName: competitorUniqueName, }),
    Meteor.users.find({
      _id: registration.userId,
    }, {
      fields: {
        _id: 1,
        'profile.name': 1,
      }
    }),

    // TODO - does this need a db index?
    Results.find({ competitionId: competitionId, userId: registration.userId, }),
  ];
});

Meteor.publish('roundResults', function(competitionUrlId, eventCode, nthRound) {
  check(competitionUrlId, String);
  check(eventCode, String);
  check(nthRound, Number);
  var competitionId = competitionUrlIdToId(competitionUrlId);
  if(!competitionId) {
    return [];
  }
  var round = Rounds.findOne({
    competitionId: competitionId,
    eventCode: eventCode,
    nthRound: nthRound,
  }, {
    fields: {
      _id: 1,
    }
  });
  if(!round) {
    return [];
  }
  return [
    Results.find({ roundId: round._id, }),
  ];
});

Meteor.publish('competitionScrambles', function(competitionUrlId) {
  check(competitionUrlId, String);
  var competitionId = competitionUrlIdToId(competitionUrlId);
  if(!competitionId) {
    return [];
  }
  if(getCannotManageCompetitionReason(this.userId, competitionId)) {
    return [];
  }

  return [
    Groups.find({ competitionId: competitionId })
  ];
});

Meteor.publish('allSiteAdmins', function() {
  if(!this.userId) {
    return new Meteor.Error(403, "Must sign in");
  }
  var siteAdmin = getUserAttribute(this.userId, 'siteAdmin');
  if(!siteAdmin) {
    return new Meteor.Error(403, "Must be a site admin");
  }
  return [
    Meteor.users.find({ siteAdmin: true }, { fields: userFieldsToPublish }),
  ];
});

// Copied and modified from https://github.com/mizzao/meteor-autocomplete/blob/master/autocomplete-server.coffee
Meteor.publish('autocompleteSubscription', function(selector, options, collName) {
  var collection = global;
  collName.split(".").forEach(function(part) {
    collection = collection[part];
  });
  // guard against client-side DOS: hard limit to 50
  options.limit = Math.min(50, Math.abs(options.limit || 0));

  // Push this into our own collection on the client so they don't interfere with other publications of the named collection.
  // This also stops the observer automatically when the subscription is stopped.
  Autocomplete.publishCursor(collection.find(selector, options), this);

  // Mark the subscription ready after the initial addition of documents.
  this.ready();
});
