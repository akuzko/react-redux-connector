import React, { PropTypes, Component } from 'react';
import { createStore } from 'redux';
import { Reductor, Connector, Connection } from '../../src';
import { mount } from 'enzyme';
import expect from 'expect';

describe('<Reductor />', function() {
  class TestConnection extends Connection {
    render() { return <div>{this.props.text}</div>; }
  }

  class FooConnector extends Connector {
    static $connection = TestConnection;
    static $state = {};
    static $reducer = FooConnector.reduce('common.foo', (state) => ({
      $set: (key, value) => ({ ...state, [key]: value })
    }));
  }

  class BarConnector extends Connector {
    static $connection = TestConnection;
    static $state = {};
    static $reducer = BarConnector.reduce('common.bar', (state) => ({
      $set: (key, value) => ({ ...state, [key]: value })
    }));
  }

  class BazConnector extends Connector {
    static $connection = TestConnection;
    static $state = {};
    static $reducer = BazConnector.reduce('common.baz', (state) => ({
      $set: (key, value) => ({ ...state, [key]: value })
    }));
  }

  class MockRoute extends Component {
    static propTypes = {
      komponent: PropTypes.func
    };

    render() {
      const { komponent, ...props } = this.props;
      return React.createElement(komponent, props);
    }
  }

  beforeEach(function() {
    this.wrapper = mount(
      <Reductor createStore={createStore} connectors={[BazConnector]} connectorProp="komponent">
        <MockRoute komponent={FooConnector} />
        <div className="deeply-nested-connector">
          <MockRoute komponent={BarConnector} />
          <div>some content</div>
        </div>
      </Reductor>
    );
    this.store = this.wrapper.instance().store;
  });

  it('renders passed children', function() {
    expect(this.wrapper.contains(<div>some content</div>)).toBe(true);
  });

  it('generates a reducer function based on props and child connectors and creates a store based on it', function() {
    expect(this.store.getState()).toEqual({ common: { foo: {}, bar: {}, baz: {} } });

    this.store.dispatch({ type: 'common.foo/$set', args: ['text', 'A Text'] });

    expect(this.store.getState()).toEqual({ common: { foo: { text: 'A Text' }, bar: {}, baz: {} } });
    expect(this.wrapper.contains(<div>A Text</div>)).toBe(true);

    this.store.dispatch({ type: 'common.baz/$set', args: ['text', 'Not mounted'] });

    expect(this.store.getState()).toEqual({ common: { foo: { text: 'A Text' }, bar: {}, baz: { text: 'Not mounted' } } });
  });
});
