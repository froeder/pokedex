import React from "react";
import {
  ScrollView,
  Image,
  Text,
  View,
  ActivityIndicator
} from "react-native";
import { Searchbar, Card } from "react-native-paper";
import { TouchableOpacity } from "react-native-gesture-handler";
import axios from 'axios';


export default class home extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { search: '', pokemon: {}, loading: false, notFound: false }

  }

  componentDidMount() {
  }


  searchPokemon = (search: string) => {
    if (search.length < 3) return
    axios.get(`https://pokeapi.co/api/v2/pokemon/${search.toLowerCase()}`).then((response) => {
      console.log(response)
      if (!response) this.setState({ notFound: true })
      this.setState({ pokemon: response.data, loading: false })
    })
  }

  renderImageType = (type: string) => {
    console.log(type)
    switch (type) {
      case 'bug':
        return require(`../assets/bug.png`);
      case 'dark':
        return require(`../assets/dark.png`);
      case 'dragon':
        return require(`../assets/dragon.png`);
      case 'electric':
        return require(`../assets/eletric.png`);
      case 'fairy':
        return require(`../assets/fairy.png`);
      case 'fighting':
        return require(`../assets/fighting.png`);
      case 'fire':
        return require(`../assets/fire.png`);
      case 'flying':
        return require(`../assets/flying.png`);
      case 'ghost':
        return require(`../assets/ghost.png`);
      case 'grass':
        return require(`../assets/grass.png`);
      case 'ground':
        return require(`../assets/ground.png`);
      case 'ice':
        return require(`../assets/ice.png`);
      case 'normal':
        return require(`../assets/normal.png`);
      case 'poison':
        return require(`../assets/poison.png`);
      case 'psychic':
        return require(`../assets/psychic.png`);
      case 'rock':
        return require(`../assets/rock.png`);
      case 'steel':
        return require(`../assets/steel.png`);
      case 'water':
        return require(`../assets/water.png`);
    }

  }

  render() {
    return (
      <>
        <Searchbar
          placeholder="Pesquisar"
          value={this.state.search}
          onChangeText={(text) => {
            this.setState({ loading: true })
            this.setState({ search: text });
            this.searchPokemon(text)
          }}
        />
        <ScrollView style={{ padding: 20 }}>
          {!this.state.pokemon.abilities ? (
            <View style={{ justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold' }}>POKEDEX</Text>
            </View>
          ) : (
              <>
                {!this.state.loading && this.state.pokemon.sprites ? (
                  <Card >
                    <Card.Content style={{ flexDirection: 'row', flex: 1, width: '100%' }}>
                      <Image
                        style={{
                          width: 90,
                          height: 130
                        }}
                        source={{
                          uri: this.state.pokemon.sprites.front_default
                        }}
                      />
                      <View style={{ width: '70%', paddingLeft: 15, flexDirection: 'column', justifyContent: 'space-evenly' }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{this.state.pokemon.name.toUpperCase()}</Text>
                        <View style={{ paddingTop: 5, flexDirection: 'row' }}>
                          <Text>Tipo: </Text>
                          {this.state.pokemon.types.map((item) => {
                            return (
                              <Image style={{ width: 20, height: 20 }} source={this.renderImageType(item.type.name)} />
                            )
                          })
                          }
                        </View>
                        <View>
                          <Text>XP: {this.state.pokemon.base_experience}</Text>
                        </View>
                      </View>
                      <View style={{ justifyContent: 'center' }}>
                        <Text>></Text>
                      </View>

                    </Card.Content>
                  </Card>
                ) : (
                    <>
                      {this.state.notFound ? (
                        <View>
                          <Text>Não encontrado</Text>
                        </View>
                      ) : (
                          <ActivityIndicator />
                        )}

                    </>
                  )}
              </>
            )}


        </ScrollView>
      </>
    );
  }
}



export type Props = {};

export type State = {
  search: string;
  pokemon: any;
  loading: boolean;
  notFound: boolean;
};
