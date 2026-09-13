#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
void solve(){
    ll n;cin>>n;
    if(n<=2){
        cout<<n<<endl;
        return;
    }
    if(n&1) cout<<n*(n-1)*(n-2)<<endl;
    else{
        if(n%3!=0) cout<<n*(n-1)*(n-3)<<endl;
        else cout<<(n-1)*(n-2)*(n-3)<<endl;
    }
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T=1;//cin>>T;
    while(T--) solve();
    return 0;
}