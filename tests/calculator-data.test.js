const {test}=require('node:test');
const assert=require('node:assert/strict');
const {evaluate}=require('../calculator-data.js');
test('scientific expressions, precedence and angles',()=>{
  for(const [expression,value] of [['2+3*4',14],['2^3^2',512],['-2^2',-4],['2^-2',.25],['sqrt(9)',3],['0!',1],['log(100)',2],['inv(4)',.25],['50%',.5],['sin(30)',.5],['asin(0.5)',30],['2,5*2',5]]) assert.ok(Math.abs(evaluate(expression)-value)<1e-10,expression);
  assert.ok(Math.abs(evaluate('sin(pi/2)','rad')-1)<1e-10);
});
test('bounded parser rejects code, invalid math and excess nesting',()=>{
  for(const expression of ['', 'globalThis.alert(1)', '1/0', 'sqrt(-1)', '2^100000', '(-1)!', '171!', '1..2','1,2.3', 'sin()', '2+'.repeat(151)+'1', '('.repeat(21)+'1'+')'.repeat(21)]) assert.throws(()=>evaluate(expression),undefined,expression);
  assert.equal(evaluate('('.repeat(20)+'1'+')'.repeat(20)),1);
});
