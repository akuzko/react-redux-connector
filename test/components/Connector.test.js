import React, { PropTypes } from 'react';
import { createStore } from 'redux';
import { Connector } from '../../src';
import storeShape from '../../src/utils/storeShape';
import { shallow, mount } from 'enzyme';
import expect, { spyOn } from 'expect';

describe('Connector', function() {
  describe('.reduce', function() {
    class TestConnector extends Connector {
      static $state = [];
      static $reducer = TestConnector.reduce('foo.bar', (state) => ({
        $add: (obj) => [...state, obj]
      }));
    }

    it('sets Connector\'s $namespace', function() {
      expect(TestConnector.$namespace).toEqual('foo.bar');
    });

    it('generates dispatcher methods for Connector\'s prototype', function() {
      expect(TestConnector.prototype.$$add).toBeA(Function);
    });

    describe('returned reducer function', function() {
      function createReducedStore() {
        return createStore(TestConnector.$reducer);
      }

      it('has proper initial state', function() {
        const store = createReducedStore();
        store.dispatch({ type: null });
        expect(store.getState()).toEqual([]);
      });

      it('reduces a state with proper action', function() {
        const store = createReducedStore();
        store.dispatch({ type: 'foo.bar/$add', args: [5] });
        expect(store.getState()).toEqual([5]);
      });

      it('has built-in $reset action', function() {
        const store = createReducedStore();
        store.dispatch({ type: 'foo.bar/$add', args: [5] });
        store.dispatch({ type: 'foo.bar/$reset' });
        expect(store.getState()).toEqual([]);
      });
    });
  });

  describe('.action', function() {
    class TestConnector extends Connector {
      static $namespace = 'foo.bar';
    }

    it('returns a proper action type', function() {
      expect(TestConnector.action('$add')).toEqual('foo.bar/$add');
    });
  });
});

describe('<Connector />', function() {
  const store = createStore(state => state);
  const Provider = React.createClass({
    propTypes: { children: PropTypes.node },
    childContextTypes: { store: storeShape },
    getChildContext() { return { store }; },
    render() { return this.props.children; }
  });
  class Connection extends React.Component {
    render() { return <div className="connection" />; }
  }

  describe('initialization', function() {
    class TestConnector extends Connector {
      static $connection = () => <div />;
    }

    it('throws an error if store is undefined', function() {
      expect(function(){ shallow(<TestConnector />); })
        .toThrow('TestConnector instance expects store object in props or in context');
    });

    it('accepts store from props', function() {
      const wrapper = shallow(<TestConnector store={store} />);
      expect(wrapper.instance().store).toBe(store);
    });

    it('accepts store from context', function() {
      let instance = null;
      mount(<Provider><TestConnector ref={(inst) => instance = inst} /></Provider>);
      expect(instance.store).toBe(store);
    });
  });

  describe('lifecycle', function() {
    class TestConnector extends Connector {
      static $connection = Connection;
    }

    afterEach(function() {
      expect.restoreSpies();
    });

    describe('mounting', function() {
      it('subscribes to store with bounded handleChange function', function() {
        spyOn(TestConnector.prototype.handleChange, 'bind')
          .andReturn('handleChange.bind(this)');
        const storeSpy = spyOn(store, 'subscribe').andReturn('unsubscribe');
        const wrapper = mount(<TestConnector store={store} />);

        expect(storeSpy).toHaveBeenCalledWith('handleChange.bind(this)');
        expect(wrapper.instance().unsubscribe).toEqual('unsubscribe');
      });
    });

    describe('unmounting', function() {
      it('calls unsubscribe function assigned on mounting', function() {
        const wrapper = mount(<TestConnector store={store} />);
        const unsubscribeSpy = spyOn(wrapper.instance(), 'unsubscribe');
        const instance = wrapper.instance();

        wrapper.unmount();

        expect(unsubscribeSpy).toHaveBeenCalled();
        expect(instance.unsubscribe).toBe(null);
      });
    });
  });

  describe('handleChange', function() {
    class TestConnector extends Connector {
      static $connection = Connection;
    }

    const newState = { state: 'state' };

    beforeEach(function() {
      this.store = createStore(state => state);
      this.wrapper = mount(<TestConnector store={this.store} />);
      this.setStateSpy = spyOn(this.wrapper.instance(), 'setState');
      this.getStateSpy = spyOn(this.wrapper.instance(), 'getExposedState').andReturn(newState);
    });

    afterEach(function() {
      expect.restoreSpies();
    });

    context('when component is unmounted (unsubscribe is null)', function() {
      it('returns immediately', function() {
        this.wrapper.unmount();
        this.store.dispatch({ type: 'someAction' });

        expect(this.setStateSpy).toNotHaveBeenCalled();
      });
    });

    context('when component is mounted', function() {
      it('sets state with result of this.getExposedState', function() {
        this.store.dispatch({ type: 'someAction' });
        expect(this.setStateSpy).toHaveBeenCalledWith(newState);
      });
    });
  });

  describe('getExposedState', function() {
    class TestConnector extends Connector {
      static $connection = Connection;
      static $namespace = 'foo.bar';
    }

    afterEach(function() {
      expect.restoreSpies();
    });

    it('delegates to $expose passing local and whole state to it', function() {
      const state = { foo: { bar: 'foobar' }, baz: 'baz' };
      const store = createStore((ztate = state) => ztate);
      const spy = spyOn(TestConnector.prototype, '$expose').andReturn({});

      mount(<TestConnector store={store} />);
      expect(spy).toHaveBeenCalledWith('foobar', state);
    });

    it('exposes local state by default', function() {
      const state = { foo: { bar: { exposed: 'foobar' } } };
      const store = createStore((ztate = state) => ztate);

      const wrapper = mount(<TestConnector store={store} />);
      expect(wrapper.instance().state).toMatch({ exposed: 'foobar' });
    });

    context('when $state is not an object and exposed by default', function() {
      class TestConnector extends Connector {
        static $connection = Connection;
        static $state = [];
        static $reducer = TestConnector.reduce('foo', () => ({}));
      }

      it('throws an error', function() {
        const store = createStore(TestConnector.$reducer);
        expect(function() { mount(<TestConnector store={store} />); })
          .toThrow('TestConnector.$state should be a plain object' +
            'or there should be a $expose instance method defined that returns a plain object'
          );
      });
    });

    context('when $expose results in non-object', function() {
      class TestConnector extends Connector {
        static $connection = Connection;
        static $state = { items: [] };
        static $reducer = TestConnector.reduce('foo', () => ({}));
        $expose($state) { return $state.items; }
      }

      it('throws an error', function() {
        const store = createStore(TestConnector.$reducer);
        expect(function() { mount(<TestConnector store={store} />); })
          .toThrow('TestConnector.$state should be a plain object' +
            'or there should be a $expose instance method defined that returns a plain object'
          );
      });
    });
  });

  describe('action dispatching, dispatchers context delegation', function() {
    class TestConnector extends Connector {
      static $connection = Connection;
      static $state = [];
      static $reducer = TestConnector.reduce('foo', state => ({
        $receive: (items) => items,
        $add: (item) => [...state, item],
        $addItems: (...items) => [...state, ...items]
      }));
      $expose($state) {
        return { items: $state };
      }

      $load() {
        return this.$$receive([1, 2]);
      }

      $add(item) {
        return this.$$add(item);
      }

      $addItems(...items) {
        return this.$$addItems(...items);
      }
    }

    beforeEach(function() {
      this.store = createStore(TestConnector.$reducer);
      this.wrapper = mount(<TestConnector store={this.store} />);
      this.instance = this.wrapper.instance();
    });

    afterEach(function() {
      expect.restoreSpies();
    });

    describe('dispatch', function() {
      it('delegates to store.dispatch', function() {
        const spy = spyOn(this.store, 'dispatch');
        this.instance.dispatch('foo/$receive', [1, 2]);
        expect(spy).toHaveBeenCalledWith({ type: 'foo/$receive', args: [[1, 2]] });
      });
    });

    describe('action dispatchers', function() {
      it('delegates to dispatch method', function() {
        const spy = spyOn(this.instance, 'dispatch');
        this.instance.$$receive([1, 2]);
        expect(spy).toHaveBeenCalledWith('foo/$receive', [1, 2]);
      });

      it('can accept arbitrary number of params', function() {
        this.instance.$addItems(1, 2, 3, 4, 5);
        expect(this.store.getState()).toEqual([1, 2, 3, 4, 5]);
      });
    });

    describe('childContextTypes', function() {
      it('is an object with \'on\' property', function() {
        expect(TestConnector.childContextTypes).toMatch({
          on: React.PropTypes.object
        });
      });
    });

    describe('getChildContext', function() {
      it('has all special dispatcher methods (starting with \'$\', except $expose)', function() {
        expect(this.instance.getChildContext()).toMatch({
          on: {
            $load: Function,
            $add: Function
          }
        });
        expect(this.instance.getChildContext().on.$expose).toBe(undefined);
      });
    });
  });

  describe('rendering', function() {
    class TestConnector extends Connector {
      static $connection = Connection;
      state = { fromState: 'stateProp' };
    }

    it('throws an error when no connection is specified', function() {
      class BadConnector extends Connector {}

      expect(function(){ mount(<BadConnector store={store} />); })
        .toThrow('BadConnector should define a $connection class property');
    });

    it('renders connection component', function() {
      const wrapper = mount(<TestConnector store={store} />);
      expect(wrapper.contains(<div className="connection" />)).toBe(true);
    });

    it('passes props and state to connection component', function() {
      const wrapper = mount(<Provider><TestConnector fromProp="propProp" /></Provider>);
      expect(wrapper.find(Connection).first().props()).toEqual({
        fromState: 'stateProp',
        fromProp: 'propProp'
      });
    });
  });
});
