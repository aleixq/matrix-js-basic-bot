const assert = require('assert');

const config = require('./config.js');

const BasicMatrixBot = require('../../index.js');

describe('room membership test with `automaticallyJoinRooms: true`', function suite() {
  this.timeout(config.mochaTimeout);

  let botA;
  let botB;
  let roomId;

  before(async () => {
    botA = new BasicMatrixBot(
      config.botAId,
      config.botAPass,
      config.homeserverUrl,
      config.botAStorage,
      {
        automaticallyJoinRooms: true,
        automaticallyLeaveRooms: false,
      }
    );

    const botAConnectedPromise = new Promise((resolve) => {
      botA.on('connected', resolve);
    });

    botA.on('error', (error) => {
      throw error;
    });

    await botA.start();
    await botAConnectedPromise;

    botB = new BasicMatrixBot(
      config.botBId,
      config.botBPass,
      config.homeserverUrl,
      config.botBStorage,
      {
        automaticallyJoinRooms: true,
        automaticallyLeaveRooms: false,
      }
    );

    const botBConnectedPromise = new Promise((resolve) => {
      botB.on('connected', resolve);
    });

    botB.on('error', (error) => {
      throw error;
    });

    await botB.start();
    await botBConnectedPromise;
  });

  after(async () => {
    botA.stop();
    botB.stop();

    await new Promise((resolve) => {
      setTimeout(resolve, config.postTestCaseTimeout);
    });
  });

  it('list known rooms', async () => {
    let knownRooms = await botA.listKnownRooms();
    assert.strictEqual(knownRooms.length, 0);

    knownRooms = await botB.listKnownRooms();
    assert.strictEqual(knownRooms.length, 0);
  });

  it('create room', async () => {
    await botA.createRoom({
      visibility: 'private',
      name: 'test room',
    });

    const knownRooms = await botA.listKnownRooms();
    assert.strictEqual(knownRooms.length, 1);
    ([{ roomId }] = knownRooms);
  });

  it('invite', async () => {
    const joinPromise = new Promise((resolve) => {
      botB.on('membership', (event, member) => {
        if (member.membership === 'join'
          && member.userId === botB.clientOptions.userId
          && member.roomId === roomId) {
          resolve(member);
        }
      });
    });

    await botA.inviteUserToRoom(botB.clientOptions.userId, roomId);

    await joinPromise;
  });

  it('verify membership', async () => {
    const knownRooms = await botB.listKnownRooms();
    assert.strictEqual(knownRooms.length, 1);
    assert.strictEqual(knownRooms[0].roomId, roomId);
    const member = knownRooms[0].currentState.members[botB.clientOptions.userId];
    assert.strictEqual(member.membership, 'join');
  });

  it('leave', async () => {
    let knownRooms = await botA.listKnownRooms();
    for (const room of knownRooms) { // eslint-disable-line no-restricted-syntax
      await botA.leaveRoom(room.roomId);
    }
    knownRooms = await botA.listKnownRooms();
    assert.strictEqual(knownRooms.length, 0);

    knownRooms = await botB.listKnownRooms();
    for (const room of knownRooms) { // eslint-disable-line no-restricted-syntax
      await botB.leaveRoom(room.roomId);
    }
    knownRooms = await botB.listKnownRooms();
    assert.strictEqual(knownRooms.length, 0);
  });
});