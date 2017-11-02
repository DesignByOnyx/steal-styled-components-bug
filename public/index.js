import React from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';

const HelloWorld = styled.div`
	font-size: 2em;
	font-weight: bold;
	color: green;
`;

function AppComponent () {
	return <HelloWorld>Hello World</HelloWorld>;
}

ReactDOM.render(<AppComponent />, document.getElementById('application'));
