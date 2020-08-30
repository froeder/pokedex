import "react-native-gesture-handler";

import React, { useState } from "react";
import {
  Button,
  View,
  Text,
  TouchableOpacity,
  Image,
  AsyncStorage,
} from "react-native";
import { Avatar } from "react-native-paper";

import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createDrawerNavigator } from "@react-navigation/drawer";

import Home from "./pages/home";
import Profile from "./pages/profile";
import About from "./pages/about";
import Login from "./pages/login";

import * as firebase from "firebase";

const firebaseConfig = {
  apiKey: "AIzaSyC28GF4RBlBhs3N3Wh_DxEGrabUIYrNX20",
  authDomain: "dgamebr-7d2c6.firebaseapp.com",
  databaseURL: "https://dgamebr-7d2c6.firebaseio.com",
  projectId: "dgamebr-7d2c6",
  storageBucket: "dgamebr-7d2c6.appspot.com",
  messagingSenderId: "620129159802",
  appId: "1:620129159802:web:36b45db3ff431b356e09c3",
  measurementId: "G-QRP68E4W2W",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

const NavigationDrawerStructure = (props) => {
  //Structure for the navigatin Drawer
  const toggleDrawer = () => {
    //Props to open/close the drawer
    props.navigationProps.toggleDrawer();
  };

  return (
    <View style={{ flexDirection: "row" }}>
      <TouchableOpacity onPress={() => toggleDrawer()}>
        <Image
          source={{
            uri:
              "https://raw.githubusercontent.com/AboutReact/sampleresource/master/drawerWhite.png",
          }}
          style={{ width: 25, height: 25, marginLeft: 5 }}
        />
      </TouchableOpacity>
    </View>
  );
};

async function signOut() {
  try {
    await AsyncStorage.removeItem("@user");
  } catch (error) {
    console.log("error signing out: ", error);
    return <></>;
  }
}

function homeScreenStack({ navigation }) {
  return (
    <Stack.Navigator initialRouteName="Home">
      <Stack.Screen
        name="Home"
        component={Home}
        options={{
          title: "Home", //Set Header Title
          headerLeft: () => (
            <NavigationDrawerStructure navigationProps={navigation} />
          ),
          headerRight: () => (
            <View>
              <Avatar.Icon
                style={{ backgroundColor: "rgba(0,0,0,0)" }}
                size={54}
                icon="account"
              />
            </View>
          ),
          headerStyle: {
            backgroundColor: "#254971", //Set Header color
          },
          headerTintColor: "#fff", //Set Header text color
          headerTitleStyle: {
            fontWeight: "bold", //Set Header text style
          },
        }}
      />
    </Stack.Navigator>
  );
}

function profileScreenStack({ navigation }) {
  return (
    <Stack.Navigator initialRouteName="Profile">
      <Stack.Screen
        name="Profile"
        component={Profile}
        options={{
          title: "Perfil", //Set Header Title
          headerLeft: () => (
            <NavigationDrawerStructure navigationProps={navigation} />
          ),
          headerStyle: {
            backgroundColor: "#254971", //Set Header color
          },
          headerTintColor: "#fff", //Set Header text color
          headerTitleStyle: {
            fontWeight: "bold", //Set Header text style
          },
        }}
      />
    </Stack.Navigator>
  );
}

function aboutScreenStack({ navigation }) {
  return (
    <Stack.Navigator initialRouteName="About">
      <Stack.Screen
        name="About"
        component={About}
        options={{
          title: "Sobre", //Set Header Title
          headerLeft: () => (
            <NavigationDrawerStructure navigationProps={navigation} />
          ),
          headerRight: () => (
            <View>
              <Avatar.Icon
                style={{ backgroundColor: "rgba(0,0,0,0)" }}
                size={54}
                icon="account"
              />
            </View>
          ),
          headerStyle: {
            backgroundColor: "#254971", //Set Header color
          },
          headerTintColor: "#fff", //Set Header text color
          headerTitleStyle: {
            fontWeight: "bold", //Set Header text style
          },
        }}
      />
    </Stack.Navigator>
  );
}

function LoginScreenStack({ navigation }) {
  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen
        name="Login"
        component={Login}
        options={{
          title: "Login", //Set Header Title
          headerStyle: {
            backgroundColor: "#254971", //Set Header color
          },
          headerTintColor: "#fff", //Set Header text color
          headerTitleStyle: {
            fontWeight: "bold", //Set Header text style
          },
        }}
      />
    </Stack.Navigator>
  );
}

function App() {
  const [hasUser, setHasUser] = useState(false);

  AsyncStorage.getItem("@user").then((response) => {
    response ? setHasUser(true) : setHasUser(false);
  });

  console.log("HasUser");
  console.log(hasUser);

  if (hasUser) {
    return (
      <NavigationContainer>
        <Drawer.Navigator
          drawerContentOptions={{
            activeTintColor: "#2D8B92",
            itemStyle: { marginVertical: 5 },
          }}
        >
          <Drawer.Screen
            name="Home"
            options={{ drawerLabel: "Home" }}
            component={homeScreenStack}
          />
          <Drawer.Screen
            name="Profile"
            options={{ drawerLabel: "Perfil" }}
            component={profileScreenStack}
          />
          <Drawer.Screen
            name="About"
            options={{ drawerLabel: "Sobre" }}
            component={aboutScreenStack}
          />
          <Drawer.Screen
            name="Sair"
            options={{ drawerLabel: "Sair" }}
            component={LoginScreenStack}
          />
        </Drawer.Navigator>
      </NavigationContainer>
    );
  } else {
    return <Login setHasUser={setHasUser} />;
  }
}

export default App;
