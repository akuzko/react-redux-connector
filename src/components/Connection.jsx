import React, { PropTypes, Component } from 'react';

export default class Connection extends Component {
  static contextTypes = {
    on: PropTypes.object
  };

  constructor(props, context) {
    super(props, context);

    Object.assign(this, this.context.on);
  }
}
