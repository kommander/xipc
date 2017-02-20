// borrowed from https://medium.com/developers-writing/fibonacci-sequence-algorithm-in-javascript-b253dc7e320e#.gax7l66r9
function fibonacci(num){
  return Promise.resolve().then(() => {
    var a = 1, b = 0, temp;

    while (num >= 0){
      temp = a;
      a = a + b;
      b = temp;
      num--;
    }

    return b;
  });
}

module.exports = fibonacci;
