import React, { PropTypes, Component } from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import get from 'lodash/get';
import isPlainObject from 'lodash/isPlainObject';
import storeShape from '../utils/storeShape';

const ownProps = Object.getOwnPropertyNames;
const proto = Object.getPrototypeOf;

function generateDispatchers(actionNames) {
  actionNames.forEach(name => {
    const type = this.action(name);
    if (typeof this.prototype[`$${name}`] !== 'function') {
      this.prototype[`$${name}`] = function() {
        this.dispatch(type, ...arguments);
      };
    }
  });
}

export default class Connector extends Component {
  static reduce(namespace, stateToHandlers) {
    this.$namespace = namespace;
    const initialState = this.$state;
    const actionNames = ownProps(stateToHandlers());
    generateDispatchers.call(this, actionNames);

    return function(state = initialState, action) {
      if (!action.type) {
        return state;
      }

      if (action.type === `${namespace}/$reset`) {
        return initialState;
      }

      const [actionNamespace, actionType] = action.type.split('/');

      if (actionNamespace === namespace) {
        const handler = stateToHandlers(state)[actionType];
        if (handler) {
          return handler(...action.args);
        }
      }
      return state;
    };
  }

  static $namespace = 'global';

  static action(name) {
    return `${this.$namespace}/${name}`;
  }

  static contextTypes = {
    store: storeShape
  };

  static propTypes = {
    store: storeShape
  };

  static childContextTypes = {
    on: PropTypes.object
  };

  constructor(props, context) {
    super(props, context);
    this.store = props.store || context.store;

    if (!this.store) {
      throw new Error(`${this.constructor.name} instance expects store object in props or in context`);
    }

    this.state = this.getExposedState();

    this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);
  }

  getChildContext() {
    return { on: this.getEventHandlers() };
  }

  componentDidMount() {
    this.trySubscribe();
  }

  componentWillUnmount() {
    this.tryUnsubscribe();
  }

  trySubscribe() {
    if (!this.unsubscribe) {
      this.unsubscribe = this.store.subscribe(this.handleChange.bind(this));
    }
  }

  tryUnsubscribe() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  handleChange() {
    if (!this.unsubscribe) return;

    const state = this.getExposedState();
    this.setState(state);
  }

  getExposedState() {
    const state = this.store.getState();
    const result = this.$expose(get(state, this.constructor.$namespace) || this.constructor.$state, state);
    if (!isPlainObject(result)) {
      throw new Error(`${this.constructor.name}.$state should be a plain object` +
        'or there should be a $expose instance method defined that returns a plain object'
      );
    }
    return result;
  }

  dispatch(type, ...args) {
    return this.store.dispatch({ type, args });
  }

  $expose($state) {
    return $state || {};
  }

  getEventHandlers() {
    return ownProps(proto(this)).reduce((handlers, key) => {
      if (key[0] === '$' && key[1] != '$' && typeof this[key] === 'function' && key != '$expose') {
        handlers[key] = this[key].bind(this);
      }
      return handlers;
    }, {});
  }

  getConnection() {
    return this.constructor.$connection;
  }

  render() {
    const connectionType = this.getConnection();

    if (!connectionType) {
      throw new Error(`${this.constructor.name} should define a $connection class property`);
    }

    return React.createElement(connectionType, { ...this.props, ...this.state });
  }
}
