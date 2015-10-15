var postcss = require('postcss');
var expect  = require('chai').expect;

var plugin = require('../');

var test = function (input, output, opts, done) {
    postcss([ plugin(opts) ]).process(input).then(function (result) {
        expect(result.css).to.eql(output);
        expect(result.warnings()).to.be.empty;
        done();
    }).catch(function (error) {
        done(error);
    });
};

describe('postcss-spine', function () {

    it('changes background-color to white', function (done) {
        test('a { background-color:red }', 'a { background-color:#fff }', { fallback:true }, done);
    });

    it('removes all properties from background except color', function (done) {
        test('a { background:#dcdcdc url(foo.png) no-repeat center top; }', 'a { background:#fff; }', { fallback:true }, done);
    });

    it('changes border color to black', function (done) {
        test('a { border: 2px dashed green }', 'a { border: 2px dashed }', { }, done);
    });

    it('removes keyframe animations', function (done) {
        test('@keyframes slideIn {}', '', { }, done);
    });

    it('removes animation properties', function (done) {
        test('a { animation-name: example; animation-duration: 4s; animation-iteration-count: 3; }', 'a { }', { }, done);
    });

    it('removes animation shorthand property', function (done) {
        test('a { animation: example 5s infinite }', 'a { }', { }, done);
    });

    it('removes transition properties', function (done) {
        test('a { transition-property: all; transition-duration: 4s; transition-timing-function: ease; }', 'a { }', { }, done);
    });

    it('removes transition shorthand property', function (done) {
        test('a { transition: all 5s ease }', 'a { }', { }, done);
    });

    it('removes box-shadow', function (done) {
        test('a { box-shadow: 0 0 10px 0 red }', 'a { }', { }, done);
    });

});
