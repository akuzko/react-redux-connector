import React, { PropTypes, Children, Component } from 'react';

import flatten from 'lodash/flatten';
import set from 'lodash/set';
import get from 'lodash/get';
import groupBy from 'lodash/groupBy';
import forEach from 'lodash/forEach';
import storeShape from '../utils/storeShape';

export default class Reductor extends Component {
  static propTypes = {
    createStore: PropTypes.func.isRequired,
    connectorProp: PropTypes.string,
    children: PropTypes.node.isRequired
  };

  static defaultProps = {
    connectorProp: 'component'
  };

  static childContextTypes = {
    store: storeShape.isRequired
  };

  getChildContext() {
    return { store: this.store };
  }

  constructor(props, context) {
    super(props, context);
    const reducer = this.getReducer();
    this.store = this.props.createStore(reducer);
  }

  getConnectors(childrenToProcess = this.props.children) {
    const tmp = Children.map(childrenToProcess, (child) => {
      const connectors = [];
      const { [this.props.connectorProp]: component, children } = (child.props || {});
      if (component && component.$reducer) {
        connectors.push(component);
      }
      if (children) {
        connectors.push(...this.getConnectors(children));
      }
      // weird thing: for some reason, when array is returned (i.e. return connectors),
      // React abandons all elements in it.
      return { connectors };
    });
    return flatten(tmp.map(container => container.connectors));
  }

  getReducer() {
    const connectors = groupBy(this.getConnectors(), '$namespace');

    return function(state = {}, action) {
      const newState = {};

      forEach(connectors, (group, namespace) => {
        const namespaceState = group.reduce((st, connector) => {
          return connector.$reducer(st, action);
        }, get(state, namespace));
        set(newState, namespace, namespaceState);
      });
      return newState;
    };
  }

  render() {
    return <div>{ this.props.children }</div>;
  }
}
