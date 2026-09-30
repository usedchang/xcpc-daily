#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
const ll inf=1e18;
void solve(){
    int n;cin>>n;
    vector<ll>a(n+1);
    for(int i=1;i<=n;i++) cin>>a[i];
    sort(a.begin()+1,a.end());
    a.erase(unique(a.begin()+1,a.end()),a.end());
    n=a.size()-1;
    int op=1;
    for(int i=1;i<=n;i++){
        if(a[i]-a[i-1]!=1){
            if(op){
                cout<<"Alice"<<endl;
                return;
            }
            else{
                cout<<"Bob"<<endl;
                return;
            }
        }
        op^=1;
    }
    if(op) cout<<"Bob"<<endl;
    else cout<<"Alice"<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T=1;cin>>T;
    while(T--) solve();
    return 0;
}
