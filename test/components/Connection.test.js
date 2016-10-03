import React from 'react';
import { createStore } from 'redux';
import { Connector, Connection } from '../../src';
import { mount } from 'enzyme';
import expect from 'expect';

describe('<Connection />', function() {
  class TestConnection extends Connection {
    load() {
      return this.$load([1, 2, 3]);
    }
    render() {
      return <div className="connection" onClick={() => this.load()} />;
    }
  }

  class TestConnector extends Connector {
    static $connection = TestConnection;
    static $state = []
    static $reducer = TestConnector.reduce('foo', () => ({
      $receive: (items) => items
    }));
    $expose($state) { return { items: $state }; }
    $load(items) { return this.$$receive(items); }
  }

  it('has event-handler methods (that start with $) provided by Connector', function() {
    const store = createStore(TestConnector.$reducer);
    const wrapper = mount(<TestConnector store={store} />);
    wrapper.find('.connection').simulate('click');
    expect(store.getState()).toEqual([1, 2, 3]);
  });
});
