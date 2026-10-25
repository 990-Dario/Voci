const assert = require('node:assert/strict');
const { getCourse, visibleCourses, schoolLevelLabel } = require('../app-data.js');

const groups = [
  { language: 'en', course: 'Young World 4', schoolLevel: 'primary' },
  { language: 'en', course: 'Open World 1', schoolLevel: 'secondary' },
  { language: 'fr', course: 'Dis Donc 6', schoolLevel: 'primary' },
  { language: 'fr', course: 'Dis Donc 7', schoolLevel: 'secondary' }
];

assert.equal(schoolLevelLabel('primary'), 'Primarschule');
assert.equal(getCourse({ language: 'fr', unit: 'Unité 3' }).schoolLevel, 'secondary');
assert.deepEqual(visibleCourses(groups, 'primary', false).map(group => group.course), ['Young World 4', 'Dis Donc 6']);
assert.deepEqual(visibleCourses(groups, 'primary', true).map(group => group.course), ['Young World 4', 'Open World 1', 'Dis Donc 6', 'Dis Donc 7']);

console.log('app-data tests passed');
