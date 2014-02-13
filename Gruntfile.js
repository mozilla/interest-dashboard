module.exports = function(grunt) {
  grunt.initConfig({
    nggettext_extract: {
      consent: {
        files: {
          'po/consent-template.pot': ['data/consent.html']
        }
      },
    },
    nggettext_compile: {
      consent: {
        files: {
          'data/consent-translations.js': ['po/consent-*.po']
        }
      },
    },
  });
  grunt.loadNpmTasks('grunt-angular-gettext');
  grunt.registerTask('extract', ['nggettext_extract']);
  grunt.registerTask('compile', ['nggettext_compile']);
  grunt.registerTask('default', ['nggettext_extract']);
}
