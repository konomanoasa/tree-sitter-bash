#include <Python.h>

#include "tree_sitter/parser.h"

const TSLanguage *tree_sitter_bash(void);
const TSLanguage *tree_sitter_bash_extglob(void);

static PyObject *language(PyObject *self, PyObject *args) {
  (void)self;
  (void)args;
  return PyCapsule_New(
    (void *)tree_sitter_bash(),
    "tree_sitter.Language",
    NULL
  );
}

static PyObject *language_extglob(PyObject *self, PyObject *args) {
  (void)self;
  (void)args;
  return PyCapsule_New(
    (void *)tree_sitter_bash_extglob(),
    "tree_sitter.Language",
    NULL
  );
}

static PyMethodDef methods[] = {
  {"language", language, METH_NOARGS, "Return the bash language capsule."},
  {"language_extglob",
    language_extglob,
    METH_NOARGS,
    "Return the bash_extglob language capsule."},
  {NULL, NULL, 0, NULL},
};

static struct PyModuleDef module = {
  PyModuleDef_HEAD_INIT,
  .m_name = "binding",
  .m_size = -1,
  .m_methods = methods,
};

PyMODINIT_FUNC PyInit_binding(void) {
  return PyModule_Create(&module);
}
