import React, { Component } from "react";
import { Text, View, AsyncStorage } from "react-native";
import { TextInput, Button } from "react-native-paper";
import { styles } from "./styles";
import * as Random from "expo-random";
import uuid from "react-native-uuid";

export class login extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { name: "", location: "", id: "" };
  }

  async componentDidMount() {
    try {
      await AsyncStorage.removeItem("@user");
    } catch (error) {
      console.log(error);
    }
  }

  setName = async () => {
    await AsyncStorage.setItem(
      "@user",
      JSON.stringify({
        name: this.state.name,
        location: this.state.location,
        id: uuid.v1(),
      })
    );

    this.props.setHasUser(true);
  };

  render() {
    return (
      <View style={styles.mainContainer}>
        <View style={{ flex: 1, height: "100%", justifyContent: "center" }}>
          <TextInput
            label="Nome"
            value={this.state.name}
            onChangeText={(text) => this.setState({ name: text })}
          />
          <TextInput
            style={{ marginTop: 20 }}
            label="Cidade / Estado"
            value={this.state.location}
            onChangeText={(text) => this.setState({ location: text })}
          />
          <Button
            mode="contained"
            color="green"
            style={{ marginTop: 40 }}
            onPress={() => this.setName()}
          >
            <Text>Salvar</Text>
          </Button>
        </View>
      </View>
    );
  }
}

type Props = {
  setHasUser: Function;
};

type State = {
  name: string;
  location: string;
  id: string;
};

export default login;
