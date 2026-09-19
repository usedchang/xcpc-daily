#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
const ll INF=1e18;
void solve(){
    ll n,m;
    cin>>n>>m;
    ll ans=INF;
    for(ll l=1,r;l<=n;l=r+1){
        ll val=(m-1)/l;
        if(val==0){
            ans=min(ans,n-m);
            break;
        }
        r=min(n,(m-1)/val);
        ans=min(ans,(n-m)+val*l);
    }
    cout<<ans<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T;cin>>T;
    while(T--) solve();
    return 0;
}