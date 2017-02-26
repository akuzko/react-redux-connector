React Redux Connector
=====================

Object-oriented React bindings for [Redux](https://github.com/reactjs/redux).

[![build status](https://img.shields.io/travis/akuzko/react-redux-connector/master.svg?style=flat-square)](https://travis-ci.org/akuzko/react-redux-connector)
[![npm version](https://img.shields.io/npm/v/react-redux-connector.svg?style=flat-square)](https://www.npmjs.com/package/react-redux-connector)

## Installation

```
npm install --save react-redux-connector
```

## Requirements

Currently, `react-redux-connector` is available only as [npm](http://npmjs.com/) package.
To effectively work with the library, you will also have to use transpiler like
[babel](https://babeljs.io/) with [es2015-classes](https://babeljs.io/docs/plugins/transform-es2015-classes)
and [class-properties](https://babeljs.io/docs/plugins/transform-class-properties) features enabled.

## Motivation

Pretty quickly after starting using `react-redux` I started to feel uncomfortability of having
my actions, reducer definitions and component code that actually uses former scattered among
different files and places in the application. Also, I didn't like nor huge switch-case
reducer functions, nor lots of same-looking small reducer functions each of which
accepts repetitive (state, action) arguments pair. As a Rails developer, I felt a need of
some kind of separate abstraction layer that will hoist all the redux-specific logic
in a declarative and DRY way. That's how the concept of redux `Connector` component was born.

## Documentation

`react-redux-connector` is inspired by Dan Abramov's awesome [react-redux](https://github.com/reactjs/react-redux)
library. At it's lowest level it uses react-redux's subscription mechanism to
redux store (this part of code was ported from react-redux), however, `react-redux-connector`
provides completely different way of organizing react-related logic of your
application and it's usage. `react-redux-connector` exports `Connector`, `Connection`
and `Reductor` classes, the most important of which is, unsuprisingly, the `Connector` class.

### Connector

Each Connector hoists all react-related logic (reducer functions, actions,
dispatching, etc) and provides bindings for your React components (which are
called connections).

#### API

Connector classes should have following properties set up:

- `static $connection` - the React component (view layer) that Connector provides
connections for.

- `static $state` - the initial redux state that will be used in reducer function.

- `static $namespace` - the path of connector's `$state` in full redux's state.
Should be something like `'profile.show'` or `'todos.list'`. It is also used
for generation of action types (which will look like `'profile.show/$receive'`).
This property is set automatically in `Connector.reduce` function that generates
required `$reducer` function (see bellow). But if connector only provides data
with no action handling, appropriate `$namespace` should be set explicitly.
Defaults to `'global'`.

- `static $reducer` - a reducer function that should be generated with `Connector.reduce`
function. **This function should be called on behalf of your connector**, i.e.
`static $reducer = TodosConnector.reduce(...)`. This function should be called like this:

```js
static $reducer = YourConnector.reduce('your.namespace', (state) => ({
  $actionOne: (arg) => newState,
  $otherAction: (arg1, arg2) => anotherNewState
}));
```

By calling `reduce` in this way, your connector's prototype gets `$$actionOne` and
`$$otherAction` methods that will **dispatch** corresponding action that will
trigger corresponding reducer's code with arguments you've passed.

- `$expose` instance method that should return object that will be passed
to $connection component in props. Yes, you can think of it as react-redux's
`mapStateToProps`. This method accepts 2 arguments: `$state` which is
current connector's state (i.e. part of the full state under connector's namespace)
and `state`, which is full redux state. Defaults to function that simply returns `$state`.

#### $-functions

All functions in connector's prototype that start with *exactly one* '$' sign
will be available in connector's connection component and all other nested
connection components.

#### Example

```js
import { Connector } from 'react-redux-connector';
import Todos from './Todos';
import { get, post, put, destroy } from 'your-requests-lib';

export default class TodosConnector extends Connector {
  static $connection = Todos;
  static $state = [];
  static $reducer = TodosConnector.reduce('todos', (state) => ({
    $receive: (items) => items,
    $addItem: (item) => [...state, item],
    $updateItem: (item) => state.map(i => i.id === item.id ? item : i),
    $removeItem: (id) => state.filter(i => i.id !== id)
  }));

  $expose($state) {
    return { items: $state };
  }

  $load() {
    return get('/todos')
      .then(response => this.$$receive(response.data));
  }

  $create(item) {
    return post('/todos', { item })
      .then(response => this.$$addItem(response.data));
  }

  $update(item) {
    return put(`/todos/${item.id}`, { item })
      .then(response => this.$$updateItem(response.data));
  }

  $destroy(id) {
    return destroy(`/todos/${id}`)
      .then(() => this.$$removeItem(id));
  }
}
```

#### External actions dispatching

If there is a need to dispatch an action of other Connector, i.e. from other namespace,
that can be done using `#dispatch` and `.action` methods, like so:

```js
// somewhere in TodosConnector.jsx

$createTodo(todo) {
  return post('/todos', { todo })
    .then(() => this.dispatch(ToolbarConnector.action('incrementTodosCount')));
}
```

### Connection

Connection is a very simple helper object that you should inherit from instead of
`React.Component`. Connection components can call all $-starting methods that
are defined in Connector (that intended to result in dispatching an action).

Note that only explicitly connected connection (i.e. the one that is specified
in connector's $connection property) gets connector's exposed state in properties.
All other connections nested under that 'main' one have usual props that you've
passed to them via React means, but they **do** have access to connector's $-functions.

#### Example

```js
import { Connection } from 'react-redux-connector';

export default class Todos extends Connection {
  state = { title: '' };

  componentDidMount() {
    this.$load();
  }

  saveItem() {
    this.$create({ title: this.state.title })
      .then(() => this.setState({ title: '' }));
  }

  destroyItem(id) {
    this.$destroy(id);
  }

  render() {
    return (
      <div>
        {this.props.items.map(item =>
          <div key={item.id}>
            {item.title}
            <button onClick={() => this.destroyItem(item.id)}>Delete</button>
          </div>
        )}
        <input onChange={(e) => this.setState({ title: e.target.value })} />
        <button onClick={() => this.saveItem()}>Save</button>
      </div>
    );
  }
}
```

**NOTE:** if you don't want to inherit from `Connection`, you can gain access to
connector's $-functions using react context:

```js
class Todos extends Component {
  static contextTypes = {
    on: PropTypes.object
  };

  componentDidMount() {
    this.context.on.$load();
  }

  // ...
}
```

Actually, that's only one thing Connection does - provides a kind of syntactic
sugar for calling connector's $-functions.

### Reductor

Reductor is a special helper component that acts as react-redux's state provider,
but it's main purpose is to generate a store reducer function for you. On initialization
it will traverse all children tree looking for connectors, collect them and use
to create and provide store with given createStore prop. Connectors that are not
present in the children tree should be listed in `connectors` property. Naturally,
the most obvious example is usage with [react-router](https://www.npmjs.com/package/react-router)
routes.

```js
import { Reductor } from 'react-redux-connector';
import { createStore } from 'redux';

import Profile from 'application/ProfileConnector';
import Todos from 'application/todos/TodosCollector';
import TodoDetails from 'application/todos/TodoDetailsConnector';

export default class App extends Component {
  return (
    <Reductor createStore={createStore}>
      <Router history={history}>
        <IndexRedirect to="/profile" />
        <Route path="/profile" component={Profile} />
        <Route path="/todos" component={Todos} />
        <Route path="/todos/:id" component={TodoDetails} />
      </Router>
    </Reductor>
  );
}
```

#### Reductor Props

| Prop Name       | Spec                                                     | Description |
|-----------------|----------------------------------------------------------|-------------|
| `createStore`   | **required** `PropTypes.func`                            | A function that takes reducer function (generated by a Reductor) as an argument and returns a redux state |
| `connectors`    | *optional* `PropTypes.arrayOf(PropTypes.func)`           | An array of connectors that cannot be mentioned in children tree, but whose `$reducer` functions should become a part of generated redux reducer function |
| `connectorProp` | *optional* `PropTypes.string`, defaults to `'component'` | A prop of components in children tree that contains a Connector as a value |


## License

MIT
