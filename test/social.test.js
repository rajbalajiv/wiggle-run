import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeXHandle, creatorProfileUrl, gameUrl, buildXCaption, xIntentUrl } from '../social.js';

test('X handle validation and safe profile links', () => {
 assert.equal(normalizeXHandle('@robot_lab'), 'robot_lab');
 assert.equal(normalizeXHandle(' https://x.com/hacker'), '');
 assert.equal(normalizeXHandle('robot/name'), '');
 assert.equal(creatorProfileUrl('robot_lab'), 'https://x.com/robot_lab');
 assert.equal(creatorProfileUrl(''), '');
});
test('share URL excludes demo query parameters', () => {
 assert.equal(gameUrl('https://wiggle-run.vercel.app/?demo=1'), 'https://wiggle-run.vercel.app/');
 const share = new URL(xIntentUrl('play Wiggle Run', 'https://wiggle-run.vercel.app/?demo=1'));
 assert.equal(share.pathname, '/intent/tweet');
 assert.equal(share.searchParams.get('text'), 'play Wiggle Run');
 assert.equal(share.searchParams.get('url'), 'https://wiggle-run.vercel.app/');
});
test('share caption includes result and creator mention when configured', () => {
 const text = buildXCaption({name:'Alpha',course:'Hairpin',distance:61.23,seconds:29.1,outcome:'OUT OF BOUNDS'},'test_robot');
 assert.match(text,/61\.2%/);
 assert.match(text,/Hairpin/);
 assert.match(text,/challenge 3 other robot owners/);
 assert.match(text,/@test_robot/);
 assert.doesNotMatch(text,/https/);
 const finished = buildXCaption({course:'Classic',distance:100,seconds:15.7,outcome:'FINISHED'},'');
 assert.match(finished,/finished/);
 assert.match(finished,/15\.7s/);
});
