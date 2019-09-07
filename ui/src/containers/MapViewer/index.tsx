//import clsx from 'clsx';
import React, { useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { Stage, Layer, Group, Line, Circle } from 'react-konva';
import { useQuery } from 'react-apollo-hooks';
import { loader } from 'graphql.macro';
import apollo from '../../apollo';
import Fab from '@material-ui/core/Fab';
import RefreshIcon from '@material-ui/icons/Refresh';
import NavigationIcon from '@material-ui/icons/Navigation';

const HEADER = 64
const MAP_PADDING = 64
const MAP_GEOMETRY_QUERY = loader('../../graphql/getMapGeometry.gql');
const TRAJECTORY_QUERY = loader('../../graphql/getTrajectories.gql');
const GET_ROBOT_QUERY = loader('../../graphql/getRobots.gql');
const CREATE_TRAJECTORY = loader('../../graphql/createTrajectory.gql');


const useStyles = makeStyles(theme => ({
  navigateButton: {
    position: "absolute",
    top: "100px",
    right: theme.spacing(2),
    margin: theme.spacing(2),
  },
  replanButton: {
    position: "absolute",
    top: "180px",
    right: theme.spacing(2),
    margin: theme.spacing(2),
  },
  extendedIcon: {
    marginRight: theme.spacing(1),
  },
  replanIcon: {
    marginRight: theme.spacing(1),
  },
}));


function getScale(geometry){
  let xmin = Infinity;
  let ymin = Infinity;
  let xmax = -Infinity;
  let ymax = -Infinity;

  for (let ob of geometry){
    for (let polygon of ob.external_polygons){
      let x = polygon.points.map((p) => p[0])
      let y = polygon.points.map((p) => p[1])
      xmin = Math.min(...x, xmin);
      ymin = Math.min(...y, ymin);
      xmax = Math.max(...x, xmax);
      ymax = Math.max(...y, ymax);
    }
  }

  let xscale = (window.innerWidth-2*MAP_PADDING)/(xmax - xmin)
  let yscale = (window.innerHeight-HEADER-2*MAP_PADDING)/(ymax - ymin)

  return {
    xmin: xmin,
    ymin: ymin,
    xmax: xmax,
    ymax: ymax,
    width: xmax - xmin,
    height: ymax - ymin,
    scale: Math.min(xscale, yscale)
  }
}


/**
 * scalePoints
 * Scale points so that that the map is the same size as the screen
 * Center the map geometry in the canvas
 */
function scalePoints(points, scale){
  let xcenter = scale.xmin + scale.width/2
  return points.map(element => ([
    Math.floor((element[0] - xcenter)*scale.scale + window.innerWidth/2),
    Math.floor((element[1] - scale.ymin)*scale.scale + MAP_PADDING)
  ]));
}


/**
 * inverseScalePoints
 * Scale points from map coordinates to true coordinates
 */
function inverseScalePoints(points, scale){
  let xcenter = scale.xmin + scale.width/2
  return points.map(element => ([
    (element[0] - window.innerWidth/2) / scale.scale + xcenter
    (element[1] - MAP_PADDING) / scale.scale + scale.ymin
  ]));
}


/**
 * Subscribe to robot position
 * Calls @callback with the position of every robot everytime
 * there is a change
 *
function subscribeRobotPosition(callback){
  GraphqlClient.query({query: GET_ROBOTS}).then(data => {
    // @ts-ignore
    let robotsCurrent = data.data.meshesCurrent;
    callback(robotsCurrent);

    for (let i=0; i<meshesCurrent.length; i++){
      let mesh = meshesCurrent[i]
      SubscriptionClient.subscribe({
        query: SUBSCRIBE_MESH_POSITION,
      }).subscribe({
        next (data) {
          // @ts-ignore
          for (let j=0; j<robotsCurrent.length; j++){
            if (robotsCurrent[j].id==data.data.meshPosition.id){
              robotsCurrent[j].x = data.data.meshPosition.x
              robotsCurrent[j].y = data.data.meshPosition.z
              robotsCurrent[j].z = data.data.meshPosition.z
              robotsCurrent[j].theta = data.data.meshPosition.theta
              callback(robotsCurrent);
            }
          }
        }
      })
    }
  });
}
*/



/**
 * Map Polygon
 * Draw a single polygon object
 *
 */
function MapPolygon(props) {
  let scaled = scalePoints(props.points, props.scale)
  // Create all the scaled lines

  return (
    <Line
      points={scaled.flat()}
      stroke='black'
      strokeWidth={2}
      closed={true}
    />
  )
}


/**
 * Map Robot
 * Draw a single circle for a robot
 *
 */
function Robot(props) {
  let center = [props.robot.x, props.robot.y]
  let scaled = scalePoints([center], props.scale)
  // Create all the scaled lines

  return (
    <Group>
      <Circle
        x={scaled[0][0]}
        y={scaled[0][1]}
        radius={12}
        stroke="blue"
      />
      <Circle
        x={scaled[0][0]}
        y={scaled[0][1]}
        radius={12}
        fill="blue"
        opacity={0.4}
      />
    </Group>
  )
}


/**
 * StartNavigation
 * Button to start navigation process
 */
function StartNavigation() {
  const classes = useStyles();
  return (
    <Fab variant="extended" aria-label="delete" className={classes.navigateButton}>
      <NavigationIcon className={classes.extendedIcon} />
      Start
    </Fab>
  )
}

/**
 * Replan
 * Button to start replan navigation path
 * Creates a new trajectory with startPoint a the robot and endPoint at the target
 *
 */
function Replan(props) {
  const classes = useStyles();
  return (
    <Fab variant="extended" aria-label="delete" onClick={props.onClick} className={classes.replanButton}>
      <RefreshIcon className={classes.replanIcon} />
      Replan
    </Fab>
  )
}

/**
 * Map Target
 * Draw a single target for a robot
 *
 */
function Target(props) {
  let scaled = scalePoints([props.center], props.scale)

  function onChange(e){
    debugger
    let position = inverseScalePoints([e.center], props.scale);
    props.onChange(position);
  }

  return (
    <Group draggable dragend={onChange} >
      <Circle
        x={scaled[0][0]}
        y={scaled[0][1]}
        radius={12}
        stroke="green"
      />
      <Circle
        x={scaled[0][0]}
        y={scaled[0][1]}
        radius={12}
        fill="green"
        opacity={0.4}
      />
      <Circle
        x={scaled[0][0]}
        y={scaled[0][1]}
        radius={6}
        fill="green"
        opacity={1.0}
      />
    </Group>
  )
}


/**
 * Trajectory
 * Draw a single trajectory
 *
 */
function MapTrajectory(props) {
  const trajectory = props.trajectory;
  const scaled = scalePoints(trajectory.points, props.scale)
  let [line, SetLine] = useState(scaled.flat());

  let points = scaled.map((p,i) => (
    <Circle
      key={i}
      x={p[0]}
      y={p[1]}
      draggable
      radius={5}
      fill="red"
      onDragMove={(e) => {
        line[2*i] = e.target.attrs.x;
        line[2*i+1] = e.target.attrs.y;
        SetLine(line)
      }}
    />
  ))

  // Create all the scaled lines
  return (
    <Group>
      <Line
        points={line}
        stroke='red'
        strokeWidth={2}
        closed={false}
      />
      { points }
    </Group>
  )
}


export default function MapViewer() {
    const options = {} //{ pollInterval: 1000 }
    const { data, error, loading } = useQuery(MAP_GEOMETRY_QUERY, options);
    const { data: trajData, error: trajError} = useQuery(TRAJECTORY_QUERY, options);
    const { data: robotData, error: robotError} = useQuery(GET_ROBOT_QUERY, options);
    //const classes = useStyles();
    //const theme = useTheme();

    if (loading) {
      return <div>Loading...</div>;
    }
    if (error) {
      return <div>Error! {error.message}</div>;
    }

    if (trajError) {
      return <div>Trajectory Fetch Error! {trajError.message}</div>;
    }

    if (robotError) {
      return <div>Robot Fetch Error! {robotError.message}</div>;
    }

    // Create all the polygons
    const scale = getScale(data.mapGeometry);
    const polygonElements = data.mapGeometry.map((ob, j)=> {
      return ob.external_polygons.map((polygon, i) => {
        let key = ob.name + '-' + j + '-' + i;
        return <MapPolygon key={ key } points={polygon.points} scale={scale} />
      })
    })

    const canvasHeight = window.innerHeight - HEADER
    const canvaseWidth = window.innerWidth - HEADER

    // Create trajectories
    const trajectories = trajData ? trajData.trajectories : [];
    const trajElements = trajectories.map(traj => (
        <MapTrajectory key={traj.id} trajectory={traj} scale={scale} />
    ))

    // Create robots
    const robots = robotData ? robotData.meshesCurrent : [];
    const robotElements = robots.map(robot => (
        <Robot key={robot.id} robot={robot} scale={scale} />
    ))

    // Create Target
    let targetPosition = [0,0]
    if (trajectories.length){
      targetPosition = trajectories[0].endPoint
    }

    // Replan button handler
    function onReplan(){
      let robot = robots[0];
      let startPoint = [robot.x, robot.y];
      let endPoint = targetPosition;
      apollo.mutate({
        mutation: CREATE_TRAJECTORY,
        variables: {
          startPoint: startPoint,
          endPoint: endPoint,
        }
      })
    }

    // Target move handler
    function onTargetMove(newPosition){
      targetPosition = newPosition;
    }

    return (
      <div>
        <Stage width={canvaseWidth} height={canvasHeight}>
          <Layer>
            <Group>{ polygonElements.flat() }</Group>
            { trajElements }
            { robotElements }
            <Target center={targetPosition} scale={scale} onChange={onTargetMove} />
          </Layer>
        </Stage>
        <StartNavigation />
        <Replan onClick={onReplan} />
      </div>
    );
}