import * as React from 'react';
import { Route, Switch } from 'react-router';
import AuthenticationRoute from './AuthenticationRoute';
import App from '../containers/App/App';
import About from '../containers/About';
import NoMatch from '../containers/NoMatch';
import Signup from '../containers/Signup';
import Signin from '../containers/Signin';
export const Routers = () => (
	<Switch>
		<Route exact path="/about" component={About} />
		<Route exact path="/sign-in" component={Signin} />
		<Route exact path="/sign-up" component={Signup} />
		<AuthenticationRoute path="/:buildingId" component={App}/>
		<Route component={NoMatch} />
  	</Switch>
)