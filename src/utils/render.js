module.exports = (template, content) => {

  var i;
  for(i in content){
    var tag = '|' + i + '|';
    template = template.replace(tag, content[i]);
  }

  return template;

}
