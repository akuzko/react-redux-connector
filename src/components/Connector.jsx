import React, { PropTypes, Component } from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import get from 'lodash/get';
import storeShape from '../utils/storeShape';

const ownProps = Object.getOwnPropertyNames;
const proto = Object.getPrototypeOf;

export default class Connector extends Component {
  static reduce(namespace, stateToHandlers) {
    this.$namespace = namespace;
    const initialState = this.$state;
    const actionNames = ownProps(stateToHandlers());
    this.__generateDispatchers(actionNames);

    return function(state = initialState, action) {
      const [actionNamespace, actionType] = action.type.split('/');

      if (actionNamespace === namespace) {
        const handler = stateToHandlers(state)[actionType];
        if (handler) {
          return handler(action.data);
        }
      }
      return state;
    };
  }

  static __generateDispatchers(actionNames) {
    actionNames.forEach(name => {
      const type = this.action(name);
      if (typeof this.prototype[`$${name}`] !== 'function') {
        this.prototype[`$${name}`] = function(data) {
          this.dispatch(type, data);
        };
      }
    });
  }

  static $namespace = 'global';

  static action(name) {
    return `${this.$namespace}/${name}`;
  }

  static get displayName() {
    const viewName = this.$connection.displayName || this.$connection.name || 'Component';

    return `Connector(${viewName})`;
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
    return this.$expose(get(state, this.constructor.$namespace) || this.constructor.$state, state);
  }

  dispatch(type, data) {
    return this.store.dispatch({ type, data });
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
    return React.createElement(this.getConnection(), { ...this.props, ...this.state });
  }
}
