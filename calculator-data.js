(function(root,factory){ const api=factory(); if(typeof module!=='undefined')module.exports=api; root.VociCalculatorData=api; })(globalThis,function(){
  function evaluate(expression, angleMode='deg') {
    if (typeof expression !== 'string' || !expression.trim() || expression.length>300 || !['deg','rad'].includes(angleMode)) throw new Error('Gib einen Ausdruck mit höchstens 300 Zeichen ein.');
    const source=expression.replaceAll('π','pi').replaceAll('×','*').replaceAll('÷','/').replaceAll('−','-').replaceAll(',','.');
    const tokens=source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[a-z]+|[+*/^()!%\-]|\S/g) || [];
    let index=0,depth=0;
    const toRad=angleMode==='deg'?Math.PI/180:1;
    const functions={sqrt:Math.sqrt,cbrt:Math.cbrt,abs:Math.abs,inv:x=>1/x,sin:x=>Math.sin(x*toRad),cos:x=>Math.cos(x*toRad),tan:x=>{if(Math.abs(Math.cos(x*toRad))<1e-14)throw new Error('Tangens ist hier nicht definiert.');return Math.tan(x*toRad);},asin:x=>Math.asin(x)/toRad,acos:x=>Math.acos(x)/toRad,atan:x=>Math.atan(x)/toRad,log:Math.log10,ln:Math.log,exp:Math.exp};
    const finite=x=>{if(!Number.isFinite(x))throw new Error('Diese Rechnung ergibt keine endliche reelle Zahl.');return x;};
    const take=token=>tokens[index]===token?(index++,true):false;
    function grouped(){
      if(++depth>20)throw new Error('Höchstens 20 ineinander liegende Klammern sind möglich.');
      const value=sum(); if(!take(')'))throw new Error('Eine schliessende Klammer fehlt.'); depth--; return value;
    }
    function atom(){
      let value; const token=tokens[index++];
      if(token==='(')value=grouped();
      else if(token==='pi')value=Math.PI;
      else if(token==='e')value=Math.E;
      else if(Object.hasOwn(functions,token)){if(!take('('))throw new Error('Nach einer Funktion folgt eine Klammer.');value=finite(functions[token](grouped()));}
      else if(token && /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(token))value=finite(Number(token));
      else throw new Error('Unbekannte Zahl oder Funktion.');
      while(tokens[index]==='!'||tokens[index]==='%'){
        if(take('%'))value/=100;
        else {index++;if(!Number.isInteger(value)||value<0||value>170)throw new Error('Fakultät ist nur für ganze Zahlen von 0 bis 170 möglich.');let result=1;for(let n=2;n<=value;n++)result*=n;value=result;}
      }
      return finite(value);
    }
    function power(){const left=atom();return take('^')?finite(left**unary()):left;}
    function unary(){if(take('+'))return unary();if(take('-'))return -unary();return power();}
    function product(){let value=unary();while(tokens[index]==='*'||tokens[index]==='/'){const op=tokens[index++],right=unary();value=finite(op==='*'?value*right:value/right);}return value;}
    function sum(){let value=product();while(tokens[index]==='+'||tokens[index]==='-'){const op=tokens[index++],right=product();value=finite(op==='+'?value+right:value-right);}return value;}
    const result=finite(sum());if(index!==tokens.length)throw new Error('Zwischen den Zahlen fehlt ein Rechenzeichen.');return Object.is(result,-0)?0:result;
  }
  return {evaluate};
});
