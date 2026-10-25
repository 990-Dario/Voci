(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined') module.exports = api;
  root.VociData = api;
})(globalThis, function () {
  const courses = {
    'Young World 1': { schoolLevel: 'primary', language: 'en' },
    'Young World 2': { schoolLevel: 'primary', language: 'en' },
    'Young World 3': { schoolLevel: 'primary', language: 'en' },
    'Young World 4': { schoolLevel: 'primary', language: 'en' },
    'Open World 1': { schoolLevel: 'secondary', language: 'en' },
    'Open World 2': { schoolLevel: 'secondary', language: 'en' },
    'Open World 3': { schoolLevel: 'secondary', language: 'en' },
    'Dis Donc 5': { schoolLevel: 'primary', language: 'fr' },
    'Dis Donc 6': { schoolLevel: 'primary', language: 'fr' },
    'Dis Donc 7': { schoolLevel: 'secondary', language: 'fr' },
    'Dis Donc 8': { schoolLevel: 'secondary', language: 'fr' },
    'Dis Donc 9': { schoolLevel: 'secondary', language: 'fr' }
  };
  function fallbackCourse(group) {
    const number = Number(String(group.unit || '').match(/\d+/)?.[0]);
    if (group.language === 'fr') return number <= 2 ? 'Dis Donc 5' : 'Dis Donc 7';
    return number <= 4 ? 'Young World 1' : 'Open World 1';
  }
  function getCourse(group) {
    const name = courses[group.course] ? group.course : fallbackCourse(group);
    return { name, ...courses[name] };
  }
  function visibleCourses(groups, schoolLevel, showOther) {
    return groups.filter(group => showOther || getCourse(group).schoolLevel === schoolLevel);
  }
  function schoolLevelLabel(level) {
    return level === 'primary' ? 'Primarschule' : 'Sekundarschule';
  }
  return { courses, getCourse, visibleCourses, schoolLevelLabel };
});
